import * as dotenv from 'dotenv';

dotenv.config();

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function normalizeBitrixWebhookToken(token: string): string {
  return token.replace(/^\/+|\/+$/g, '');
}

export interface AppEnv {
  tz: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRefreshToken: string;
  masterSheetId: string;
  masterSheetTabName: string;
  rootMonthFolderId: string;
  bitrixBaseUrl: string;
  bitrixWebhookToken: string;
  bitrixCategoryId: number;
  bitrixStageId: string;
  bitrixDealEventFieldNew: string;
  bitrixDealEventFieldUpdate: string;
}

export function loadEnv(): AppEnv {
  const bitrixCategoryIdRaw = requiredEnv('BITRIX_CATEGORY_ID');
  const bitrixCategoryId = Number(bitrixCategoryIdRaw);
  if (Number.isNaN(bitrixCategoryId)) {
    throw new Error('BITRIX_CATEGORY_ID deve ser numerico');
  }

  return {
    tz: optionalEnv('TZ', 'America/Sao_Paulo'),
    googleClientId: requiredEnv('GOOGLE_CLIENT_ID'),
    googleClientSecret: requiredEnv('GOOGLE_CLIENT_SECRET'),
    googleRefreshToken: requiredEnv('GOOGLE_REFRESH_TOKEN'),
    masterSheetId: requiredEnv('MASTER_SHEET_ID'),
    masterSheetTabName: optionalEnv('MASTER_SHEET_TAB_NAME', 'Pagina1'),
    rootMonthFolderId: requiredEnv('ROOT_MONTH_FOLDER_ID'),
    bitrixBaseUrl: requiredEnv('BITRIX_BASE_URL').replace(/\/+$/, ''),
    bitrixWebhookToken: normalizeBitrixWebhookToken(
      requiredEnv('BITRIX_WEBHOOK_TOKEN'),
    ),
    bitrixCategoryId,
    bitrixStageId: requiredEnv('BITRIX_STAGE_ID'),
    bitrixDealEventFieldNew: requiredEnv('BITRIX_DEAL_EVENT_FIELD_NEW'),
    bitrixDealEventFieldUpdate: requiredEnv('BITRIX_DEAL_EVENT_FIELD_UPDATE'),
  };
}
