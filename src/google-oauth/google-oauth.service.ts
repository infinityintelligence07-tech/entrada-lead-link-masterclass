import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ConfigService } from '../config/config.service';

type StoredToken = {
  refresh_token: string;
  scope?: string;
  token_type?: string;
  created_at: string;
};

@Injectable()
export class GoogleOauthService {
  private readonly logger = new Logger(GoogleOauthService.name);

  constructor(private readonly config: ConfigService) {}

  getStartUrl(): { url: string; redirectUri: string } {
    const oauth2 = this.buildClient();
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
      ],
    });
    return {
      url,
      redirectUri: this.config.values.googleOauthRedirectUri,
    };
  }

  async exchangeCode(code: string): Promise<{
    ok: boolean;
    message: string;
    refreshTokenMasked: string;
    tokenStoreFile: string;
  }> {
    if (!code?.trim()) {
      throw new Error('Parametro "code" ausente no callback OAuth2.');
    }

    const oauth2 = this.buildClient();
    const { tokens } = await oauth2.getToken(code);
    const refreshToken = String(tokens.refresh_token ?? '').trim();
    if (!refreshToken) {
      throw new Error(
        'Google nao retornou refresh_token. Revogue o app e autorize novamente com prompt=consent.',
      );
    }

    this.persistRefreshToken({
      refresh_token: refreshToken,
      scope: tokens.scope ?? undefined,
      token_type: tokens.token_type ?? undefined,
      created_at: new Date().toISOString(),
    });

    return {
      ok: true,
      message:
        'Refresh token salvo com sucesso no arquivo de tokens. Opcionalmente, voce tambem pode definir GOOGLE_OAUTH_REFRESH_TOKEN na env.',
      refreshTokenMasked: this.maskSecret(refreshToken),
      tokenStoreFile: this.config.values.googleOauthTokenStoreFile,
    };
  }

  getStatus(): {
    ok: boolean;
    oauthReady: boolean;
    clientIdConfigured: boolean;
    clientSecretConfigured: boolean;
    redirectUri: string;
    refreshToken: { available: boolean; source: 'env' | 'token_store' | 'missing' };
    tokenStore: {
      file: string;
      exists: boolean;
      hasRefreshToken: boolean;
      createdAt: string | null;
    };
  } {
    const clientId = this.config.values.googleClientId;
    const clientSecret = this.config.values.googleClientSecret;
    const refreshTokenResolved = this.config.values.googleRefreshToken;
    const refreshTokenFromEnv = String(
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN ?? process.env.GOOGLE_REFRESH_TOKEN ?? '',
    ).trim();
    const store = this.readTokenStoreMeta();

    return {
      ok: true,
      oauthReady: Boolean(
        clientId.trim() && clientSecret.trim() && refreshTokenResolved.trim(),
      ),
      clientIdConfigured: Boolean(clientId.trim()),
      clientSecretConfigured: Boolean(clientSecret.trim()),
      redirectUri: this.config.values.googleOauthRedirectUri,
      refreshToken: {
        available: Boolean(refreshTokenResolved.trim()),
        source: refreshTokenFromEnv
          ? 'env'
          : store.hasRefreshToken
            ? 'token_store'
            : 'missing',
      },
      tokenStore: {
        file: this.config.values.googleOauthTokenStoreFile,
        exists: store.exists,
        hasRefreshToken: store.hasRefreshToken,
        createdAt: store.createdAt ?? null,
      },
    };
  }

  private buildClient() {
    const clientId = this.config.values.googleClientId;
    const clientSecret = this.config.values.googleClientSecret;
    const redirectUri = this.config.values.googleOauthRedirectUri;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(
        'OAuth2 Google nao configurado. Defina GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET e GOOGLE_OAUTH_REDIRECT_URI.',
      );
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private persistRefreshToken(token: StoredToken): void {
    const file = this.config.values.googleOauthTokenStoreFile;
    mkdirSync(dirname(file), { recursive: true });

    let data: Record<string, unknown> = {};
    try {
      const raw = readFileSync(file, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        data = parsed as Record<string, unknown>;
      }
    } catch {
      // arquivo pode nao existir/estar vazio; vamos criar
    }

    data.google_oauth = token;
    writeFileSync(file, JSON.stringify(data, null, 2), { encoding: 'utf-8' });
    this.logger.log(`Google OAuth refresh token salvo em ${file}.`);
  }

  private readTokenStoreMeta(): {
    exists: boolean;
    hasRefreshToken: boolean;
    createdAt?: string;
  } {
    const file = this.config.values.googleOauthTokenStoreFile;
    try {
      const raw = readFileSync(file, 'utf-8');
      const parsed = JSON.parse(raw) as {
        google_oauth?: { refresh_token?: string; created_at?: string };
      };
      const refresh = String(parsed?.google_oauth?.refresh_token ?? '').trim();
      const createdAt = String(parsed?.google_oauth?.created_at ?? '').trim();
      return {
        exists: true,
        hasRefreshToken: Boolean(refresh),
        createdAt: createdAt || undefined,
      };
    } catch {
      return { exists: false, hasRefreshToken: false };
    }
  }

  private maskSecret(secret: string): string {
    if (!secret) return '';
    if (secret.length <= 8) return '********';
    return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
  }
}
