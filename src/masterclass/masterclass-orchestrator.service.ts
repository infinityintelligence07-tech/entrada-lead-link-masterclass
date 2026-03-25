import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { ConfigService } from "../config/config.service";
import { sleep } from "../common/sleep";
import { GoogleSheetsService } from "../integrations/google-sheets.service";
import { GoogleDriveService } from "../integrations/google-drive.service";
import { BitrixService } from "../integrations/bitrix.service";
import {
  formatEventInfo,
  shouldSendLink,
  shouldSkipWrongLine,
} from "./masterclass.utils";
import { LeadRow } from "./types/masterclass.types";

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class MasterclassOrchestratorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MasterclassOrchestratorService.name);
  private readonly leadsSheetTabName = "Pagina1";
  private isFlowRunning = false;

  constructor(
    private readonly config: ConfigService,
    private readonly googleSheets: GoogleSheetsService,
    private readonly googleDrive: GoogleDriveService,
    private readonly bitrix: BitrixService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log(
      "Aplicacao iniciada: executando fluxo inicial antes da janela da cron",
    );
    await this.runFlow("startup");
  }

  @Cron("0 13,17,23 * * *", { timeZone: "America/Sao_Paulo" })
  async handleCron(): Promise<void> {
    await this.runFlow("cron");
  }

  async executeFlow(): Promise<void> {
    await this.runFlow("manual");
  }

  private async runFlow(trigger: "startup" | "cron" | "manual"): Promise<void> {
    if (this.isFlowRunning) {
      this.logger.warn(
        `Fluxo ja em execucao, nova chamada ignorada (origem=${trigger})`,
      );
      return;
    }

    this.isFlowRunning = true;
    const startAt = Date.now();
    const eventDate = dayjs()
      .tz(this.config.values.tz)
      .subtract(1, "day")
      .format("DD/MM/YYYY");

    this.logger.log(
      `Iniciando funil para DATA=${eventDate} (origem=${trigger})`,
    );

    try {
      const eventRows = await this.googleSheets.getRowsByDate(
        this.config.values.masterSheetId,
        this.config.values.masterSheetTabName,
        eventDate,
      );

      this.logger.log(`Eventos encontrados: ${eventRows.length}`);

      let processedEvents = 0;
      let failedEvents = 0;
      for (const event of eventRows) {
        await sleep(3000); // Replica o Timer 1
        try {
          await this.processEvent(event["CIDADE SLUG"], event.DATA);
          processedEvents += 1;
        } catch (error) {
          failedEvents += 1;
          this.logger.error(
            `Falha ao processar evento cidade=${event["CIDADE SLUG"]} data=${event.DATA}`,
            error as Error,
          );
        }
      }
      this.logger.log(
        `Resumo dos eventos: processados=${processedEvents} falhas=${failedEvents}`,
      );
    } catch (error) {
      this.logger.error("Erro no processamento do funil", error as Error);
    } finally {
      this.logger.log(
        `Fim do ciclo do funil (${Math.round((Date.now() - startAt) / 1000)}s)`,
      );
      this.isFlowRunning = false;
    }
  }

  private async processEvent(cidadeSlug: string, data: string): Promise<void> {
    const info = formatEventInfo(cidadeSlug, data);
    this.logger.log(`Processando evento ${info.nome}`);

    const monthFolder = await this.googleDrive.findFolderByName(
      this.config.values.rootMonthFolderId,
      info.pasta,
    );
    if (!monthFolder) {
      this.logger.warn(`Pasta do mes nao encontrada: ${info.pasta}`);
      return;
    }

    const dayFolderName = this.googleSheets.normalizeEventDateForFolder(data);
    const dayFolder = await this.googleDrive.findFolderByName(
      monthFolder.id,
      dayFolderName,
    );
    if (!dayFolder) {
      this.logger.warn(`Pasta do dia nao encontrada: ${dayFolderName}`);
      return;
    }

    const eventSheet = await this.googleDrive.findSpreadsheetByName(
      dayFolder.id,
      info.nome,
    );
    if (!eventSheet) {
      this.logger.warn(`Planilha do evento nao encontrada: ${info.nome}`);
      return;
    }

    const leads = await this.googleSheets.getLeadRows(
      eventSheet.id,
      this.leadsSheetTabName,
    );
    this.logger.log(`Leads carregados para ${info.nome}: ${leads.length}`);

    let sentToBitrix = 0;
    let skippedWrongLine = 0;
    let skippedByRule = 0;
    for (const lead of leads) {
      if (shouldSkipWrongLine(lead.Nome, lead.Whatsapp)) {
        skippedWrongLine += 1;
        continue;
      }
      if (!shouldSendLink(lead["Enviar Link"])) {
        skippedByRule += 1;
        continue;
      }

      await sleep(2000); // Replica o Timer 2
      await this.processLead(lead, info.nome);
      sentToBitrix += 1;
    }

    this.logger.log(
      `Resumo do evento ${info.nome}: enviados=${sentToBitrix} pulados_linha_invalida=${skippedWrongLine} pulados_regra_envio=${skippedByRule}`,
    );
  }

  private async processLead(lead: LeadRow, eventName: string): Promise<void> {
    try {
      this.logger.log(`Iniciando lead ${lead.Nome} (${lead.Whatsapp})`);
      const contactId = await this.bitrix.findContactIdByPhone(lead.Whatsapp);

      if (!contactId) {
        const createdContactId = await this.bitrix.createContact(lead);
        await this.bitrix.createDeal(
          lead,
          createdContactId,
          eventName,
          this.config.values.bitrixDealEventFieldNew,
        );
        this.logger.log(`Lead ${lead.Nome} finalizado com novo contato/deal`);
        return;
      }

      const deals = await this.bitrix.listDealsByContact(contactId);
      const hasDeal = Boolean(deals[0]?.ID);
      if (hasDeal) {
        this.logger.log(
          `Lead ${lead.Nome} ignorado: contato ${contactId} ja possui negocio`,
        );
        return;
      }

      await this.bitrix.updateContact(contactId, lead);
      await this.bitrix.createDeal(
        lead,
        contactId,
        eventName,
        this.config.values.bitrixDealEventFieldUpdate,
      );
      this.logger.log(
        `Lead ${lead.Nome} finalizado com atualizacao de contato ${contactId}`,
      );
    } catch (error) {
      this.logger.error(
        `Erro ao processar lead ${lead.Nome} (${lead.Whatsapp})`,
        error as Error,
      );
    }
  }
}
