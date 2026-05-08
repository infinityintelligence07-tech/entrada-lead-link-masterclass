import * as dotenv from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../.env') });

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

function optionalTrimmed(name: string): string {
  return (process.env[name] ?? '').trim();
}

function requiredAnyEnv(...names: string[]): string {
  for (const name of names) {
    const value = optionalTrimmed(name);
    if (value) return value;
  }
  throw new Error(
    `Variavel de ambiente obrigatoria ausente: ${names.join(' ou ')}`,
  );
}

function resolveOauthTokenStoreFile(): string {
  const configured = optionalTrimmed('GOOGLE_OAUTH_TOKEN_STORE_FILE');
  if (configured) {
    return isAbsolute(configured) ? configured : join(process.cwd(), configured);
  }
  return join(process.cwd(), 'oauth-tokens.json');
}

function resolveOauthRefreshToken(tokenStoreFile: string): string {
  const fromEnv = optionalTrimmed('GOOGLE_OAUTH_REFRESH_TOKEN');
  if (fromEnv) return fromEnv;

  const legacyFromEnv = optionalTrimmed('GOOGLE_REFRESH_TOKEN');
  if (legacyFromEnv) return legacyFromEnv;

  try {
    if (!existsSync(tokenStoreFile)) return '';
    const raw = readFileSync(tokenStoreFile, 'utf-8');
    const parsed = JSON.parse(raw) as { google_oauth?: { refresh_token?: string } };
    return String(parsed?.google_oauth?.refresh_token ?? '').trim();
  } catch {
    return '';
  }
}

export interface AppEnv {
  tz: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRefreshToken: string;
  googleOauthRedirectUri: string;
  googleOauthTokenStoreFile: string;
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
  const googleOauthTokenStoreFile = resolveOauthTokenStoreFile();
  const googleRefreshToken = resolveOauthRefreshToken(googleOauthTokenStoreFile);
  if (Number.isNaN(bitrixCategoryId)) {
    throw new Error('BITRIX_CATEGORY_ID deve ser numerico');
  }
  if (!googleRefreshToken) {
    throw new Error(
      'Variavel de ambiente obrigatoria ausente: GOOGLE_OAUTH_REFRESH_TOKEN ou GOOGLE_REFRESH_TOKEN (ou token no arquivo GOOGLE_OAUTH_TOKEN_STORE_FILE)',
    );
  }

  return {
    tz: optionalEnv('TZ', 'America/Sao_Paulo'),
    googleClientId: requiredAnyEnv('GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_CLIENT_ID'),
    googleClientSecret: requiredAnyEnv(
      'GOOGLE_OAUTH_CLIENT_SECRET',
      'GOOGLE_CLIENT_SECRET',
    ),
    googleRefreshToken,
    googleOauthRedirectUri:
      optionalTrimmed('GOOGLE_OAUTH_REDIRECT_URI') ||
      'http://localhost:4040/oauth2/callback',
    googleOauthTokenStoreFile,
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
