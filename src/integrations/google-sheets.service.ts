import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { GoogleAuthService } from './google-auth.service';
import { CitySlugRow, LeadRow } from '../masterclass/types/masterclass.types';

dayjs.extend(customParseFormat);

type GenericRow = Record<string, string>;

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);

  constructor(private readonly googleAuth: GoogleAuthService) {}

  async getRowsByDate(
    spreadsheetId: string,
    tabName: string,
    dateDDMMYYYY: string,
  ): Promise<CitySlugRow[]> {
    const rows = await this.readSheetRows(spreadsheetId, tabName);
    return rows
      .filter((row) => row.DATA?.trim() === dateDDMMYYYY)
      .map((row) => ({
        DATA: row.DATA ?? '',
        'CIDADE SLUG': row['CIDADE SLUG'] ?? '',
      }));
  }

  async getLeadRows(spreadsheetId: string, tabName: string): Promise<LeadRow[]> {
    const rows = await this.readSheetRows(spreadsheetId, tabName);
    return rows.map((row) => ({
      Nome: row.Nome ?? '',
      Whatsapp: row.Whatsapp ?? '',
      Email: row.Email ?? '',
      'Enviar Link': row['Enviar Link'] ?? '',
    }));
  }

  private async readSheetRows(
    spreadsheetId: string,
    tabName: string,
  ): Promise<GenericRow[]> {
    const sheets = this.googleAuth.getSheetsClient();
    const resolvedTabName = await this.resolveTabName(spreadsheetId, tabName);
    const range = `${this.toA1SheetName(resolvedTabName)}!A:Z`;
    this.logger.log(
      `Lendo planilha ${spreadsheetId} na aba "${resolvedTabName}" (range ${range})`,
    );

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const values = data.values ?? [];
    if (values.length === 0) {
      return [];
    }

    const [headers, ...rows] = values;
    const normalizedHeaders = headers.map((h) => String(h).trim());

    return rows.map((row) => {
      const result: GenericRow = {};
      normalizedHeaders.forEach((header, index) => {
        result[header] = String(row[index] ?? '').trim();
      });
      return result;
    });
  }

  private async resolveTabName(spreadsheetId: string, desiredTabName: string): Promise<string> {
    const sheets = this.googleAuth.getSheetsClient();
    const desired = String(desiredTabName ?? '').trim();
    const desiredNormalized = this.normalizeName(desired);

    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(title))',
    });

    const titles = (metadata.data.sheets ?? [])
      .map((sheet) => String(sheet.properties?.title ?? '').trim())
      .filter(Boolean);

    const exact = titles.find((title) => title === desired);
    if (exact) {
      return exact;
    }

    const normalizedMatch = titles.find(
      (title) => this.normalizeName(title) === desiredNormalized,
    );
    if (normalizedMatch) {
      this.logger.warn(
        `Aba configurada "${desired}" nao encontrada; usando "${normalizedMatch}"`,
      );
      return normalizedMatch;
    }

    const firstTitle = titles[0];
    if (firstTitle) {
      this.logger.warn(
        `Aba configurada "${desired}" nao encontrada; fallback para primeira aba "${firstTitle}"`,
      );
      return firstTitle;
    }

    throw new Error(`Nenhuma aba encontrada na planilha ${spreadsheetId}`);
  }

  private toA1SheetName(tabName: string): string {
    // Sempre usa aspas simples para evitar erro de parsing no A1 notation.
    const escaped = String(tabName).replace(/'/g, "''");
    return `'${escaped}'`;
  }

  private normalizeName(value: string): string {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
  }

  normalizeEventDateForFolder(eventDate: string): string {
    const parsed = dayjs(eventDate, ['DD/MM/YYYY', 'DD/MM/YY'], true);
    if (!parsed.isValid()) {
      this.logger.warn(`Data invalida no evento: ${eventDate}`);
      return eventDate;
    }

    // Replica a transformacao do n8n: slice(0, 6) + slice(8)
    const asDDMMYYYY = parsed.format('DD/MM/YYYY');
    return `${asDDMMYYYY.slice(0, 6)}${asDDMMYYYY.slice(8)}`;
  }
}
