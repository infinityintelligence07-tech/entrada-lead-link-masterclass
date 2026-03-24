export interface CitySlugRow {
  DATA: string;
  'CIDADE SLUG': string;
}

export interface SeparationInfo {
  cidade: string;
  nome: string;
  pasta: string;
}

export interface LeadRow {
  Nome: string;
  Whatsapp: string;
  Email?: string;
  'Enviar Link'?: string;
}

export interface BitrixDeal {
  ID: string;
  TITLE?: string;
  CATEGORY_ID?: string;
  STAGE_ID?: string;
  CONTACT_ID?: string;
}
