import { Injectable, Logger } from '@nestjs/common';
import { drive_v3 } from 'googleapis';
import { GoogleAuthService } from './google-auth.service';

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
}

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);

  constructor(private readonly googleAuth: GoogleAuthService) {}

  async findFolderByName(
    parentFolderId: string,
    folderName: string,
  ): Promise<DriveItem | null> {
    const exactItems = await this.searchItems(
      parentFolderId,
      folderName,
      "mimeType = 'application/vnd.google-apps.folder'",
    );
    if (exactItems[0]) {
      return exactItems[0];
    }

    // Fallback tolerante: compara nomes normalizados (acento, espacos, pontuacao e case).
    const allFolders = await this.searchItems(
      parentFolderId,
      '',
      "mimeType = 'application/vnd.google-apps.folder'",
    );
    const normalizedTarget = this.normalizeName(folderName);
    const fallback = allFolders.find((item) => {
      const normalizedCandidate = this.normalizeName(item.name);
      return (
        normalizedCandidate === normalizedTarget ||
        normalizedCandidate.includes(normalizedTarget) ||
        normalizedTarget.includes(normalizedCandidate)
      );
    });

    if (fallback) {
      this.logger.warn(
        `Pasta encontrada por fallback de nome: solicitado="${folderName}" encontrado="${fallback.name}"`,
      );
      return fallback;
    }

    const sample = allFolders
      .slice(0, 5)
      .map((folder) => folder.name)
      .join(', ');
    this.logger.warn(
      `Nenhuma pasta do mes encontrada para "${folderName}". Pastas disponiveis: ${sample || 'nenhuma'}`,
    );
    return null;
  }

  async findSpreadsheetByName(
    parentFolderId: string,
    spreadsheetName: string,
  ): Promise<DriveItem | null> {
    const items = await this.searchItems(
      parentFolderId,
      spreadsheetName,
      "mimeType = 'application/vnd.google-apps.spreadsheet'",
    );
    return items[0] ?? null;
  }

  private async searchItems(
    parentFolderId: string,
    queryName: string,
    mimeTypeFilter: string,
  ): Promise<DriveItem[]> {
    const drive = this.googleAuth.getDriveClient();
    const escapedName = queryName.replace(/'/g, "\\'");
    const q = [
      `'${parentFolderId}' in parents`,
      'trashed = false',
      mimeTypeFilter,
      ...(escapedName ? [`name contains '${escapedName}'`] : []),
    ].join(' and ');
    this.logger.log(`Drive query: ${q}`);

    const response = await drive.files.list({
      q,
      fields: 'files(id,name,mimeType)',
      pageSize: 50,
      spaces: 'drive',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    const files = response.data.files ?? [];
    return files
      .filter((file): file is drive_v3.Schema$File & { id: string; name: string; mimeType: string } => {
        return Boolean(file.id && file.name && file.mimeType);
      })
      .map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
      }));
  }

  private normalizeName(value: string): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  }
}
