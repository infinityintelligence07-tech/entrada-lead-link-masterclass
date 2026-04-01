import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '../config/config.service';
import { LeadRow } from '../masterclass/types/masterclass.types';

interface DuplicateByCommResult {
  CONTACT?: number[];
}

interface BitrixDealResult {
  ID: string;
  TITLE?: string;
  CATEGORY_ID?: string;
  STAGE_ID?: string;
  CONTACT_ID?: string;
}

interface BitrixMultiField {
  VALUE: string;
  VALUE_TYPE: 'WORK';
}

@Injectable()
export class BitrixService {
  private readonly logger = new Logger(BitrixService.name);
  private readonly client: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.client = axios.create({
      baseURL: this.config.values.bitrixBaseUrl,
      timeout: 30000,
    });
  }

  async findContactIdByPhone(rawPhone: string): Promise<number | null> {
    const phoneCandidates = this.buildPhoneCandidates(rawPhone);
    if (phoneCandidates.length === 0) {
      this.logger.warn('Telefone vazio/invalido para busca de contato no Bitrix');
      return null;
    }

    const payload = {
      entity_type: 'CONTACT',
      type: 'PHONE',
      values: phoneCandidates,
    };

    const response = await this.call<DuplicateByCommResult>(
      'crm.duplicate.findbycomm',
      payload,
    );

    const contactId = response?.CONTACT?.[0];
    return contactId ?? null;
  }

  async listDealsByContact(contactId: number): Promise<BitrixDealResult[]> {
    const customField = this.config.values.bitrixDealEventFieldNew;
    this.logger.log(`Buscando negocios do contato ${contactId}`);
    const result = await this.call<BitrixDealResult[]>('crm.deal.list', {
      select: ['ID', 'TITLE', 'CATEGORY_ID', 'STAGE_ID', 'CONTACT_ID', customField],
      filter: {
        CONTACT_ID: contactId,
        CATEGORY_ID: this.config.values.bitrixCategoryId,
        [`!${customField}`]: '',
      },
    });

    return Array.isArray(result) ? result : [];
  }

  async createContact(lead: LeadRow): Promise<number> {
    this.logger.log(`Criando contato no Bitrix para ${lead.Nome}`);
    const result = await this.call<number>('crm.contact.add', {
      fields: this.buildContactFields(lead),
    });

    const contactId = Number(result);
    if (!Number.isFinite(contactId) || contactId <= 0) {
      throw new Error(`Bitrix retornou ID de contato invalido: ${String(result)}`);
    }

    this.logger.log(`Contato criado no Bitrix com ID=${contactId}`);
    return contactId;
  }

  async updateContact(contactId: number, lead: LeadRow): Promise<void> {
    this.logger.log(`Atualizando contato ${contactId} no Bitrix`);
    await this.call('crm.contact.update', {
      id: contactId,
      fields: this.buildContactFields(lead),
    });
  }

  async createDeal(
    lead: LeadRow,
    contactId: number,
    eventName: string,
    dealEventField: string,
  ): Promise<number> {
    this.logger.log(`Criando negocio para contato ${contactId} (${eventName})`);
    const result = await this.call<number>('crm.deal.add', {
      fields: {
        TITLE: lead.Nome,
        CONTACT_ID: contactId,
        CATEGORY_ID: this.config.values.bitrixCategoryId,
        STAGE_ID: this.config.values.bitrixStageId,
        [dealEventField]: eventName,
        UF_CRM_1765898862: 708,
        UF_CRM_1764868042: 530,
      },
    });

    const dealId = Number(result);
    if (!Number.isFinite(dealId) || dealId <= 0) {
      throw new Error(`Bitrix retornou ID de negocio invalido: ${String(result)}`);
    }

    this.logger.log(`Negocio criado no Bitrix com ID=${dealId}`);
    return dealId;
  }

  private async call<T = unknown>(
    method: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.config.values.bitrixWebhookToken}/${method}.json`;
    const response = await this.client.post(url, params);

    if (response.data?.error) {
      const errorText = `${response.data.error}: ${response.data.error_description ?? ''}`;
      this.logger.error(`Erro Bitrix em ${method}: ${errorText}`);
      throw new Error(errorText);
    }

    return response.data?.result as T;
  }

  private buildPhoneCandidates(rawPhone: string): string[] {
    const normalized = this.normalizePhone(rawPhone);
    if (!normalized) {
      return [];
    }

    const with55 = normalized;
    return [`+${with55}`, with55, with55.replace(/^55/, '')];
  }

  private buildContactFields(lead: LeadRow): Record<string, unknown> {
    const fields: Record<string, unknown> = {
      NAME: lead.Nome,
    };

    const phoneField = this.phoneField(lead.Whatsapp);
    if (phoneField) {
      fields.PHONE = [phoneField];
    } else {
      this.logger.warn(`Lead ${lead.Nome} sem telefone valido para contato`);
    }

    const emailField = this.emailField(lead.Email);
    if (emailField) {
      fields.EMAIL = [emailField];
    }

    return fields;
  }

  private normalizePhone(phone: string): string | null {
    const digits = String(phone ?? '').replace(/\D/g, '');
    if (!digits) {
      return null;
    }

    const normalized = digits.startsWith('55') ? digits : `55${digits}`;
    if (normalized.length < 12) {
      return null;
    }

    return normalized;
  }

  private phoneField(phone: string): BitrixMultiField | null {
    const normalized = this.normalizePhone(phone);
    if (!normalized) {
      return null;
    }

    return {
      VALUE: `+${normalized}`,
      VALUE_TYPE: 'WORK',
    };
  }

  private emailField(email?: string): BitrixMultiField | null {
    const value = String(email ?? '').trim();
    if (!value) {
      return null;
    }

    return {
      VALUE: value,
      VALUE_TYPE: 'WORK',
    };
  }
}
