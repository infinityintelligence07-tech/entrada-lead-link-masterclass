import { Injectable } from '@nestjs/common';
import { google, sheets_v4, drive_v3 } from 'googleapis';
import { ConfigService } from '../config/config.service';

@Injectable()
export class GoogleAuthService {
  constructor(private readonly config: ConfigService) {}

  private getOAuthClient(
    scopes: string[],
  ): InstanceType<typeof google.auth.OAuth2> {
    const auth = new google.auth.OAuth2({
      clientId: this.config.values.googleClientId,
      clientSecret: this.config.values.googleClientSecret,
    });

    auth.setCredentials({
      refresh_token: this.config.values.googleRefreshToken,
      scope: scopes.join(' '),
    });

    return auth;
  }

  getSheetsClient(): sheets_v4.Sheets {
    const auth = this.getOAuthClient([
      'https://www.googleapis.com/auth/spreadsheets.readonly',
    ]);

    return google.sheets({ version: 'v4', auth });
  }

  getDriveClient(): drive_v3.Drive {
    const auth = this.getOAuthClient([
      'https://www.googleapis.com/auth/drive.readonly',
    ]);

    return google.drive({ version: 'v3', auth });
  }
}
