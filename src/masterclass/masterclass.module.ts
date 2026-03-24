import { Module } from '@nestjs/common';
import { MasterclassOrchestratorService } from './masterclass-orchestrator.service';
import { GoogleAuthService } from '../integrations/google-auth.service';
import { GoogleSheetsService } from '../integrations/google-sheets.service';
import { GoogleDriveService } from '../integrations/google-drive.service';
import { BitrixService } from '../integrations/bitrix.service';

@Module({
  providers: [
    MasterclassOrchestratorService,
    GoogleAuthService,
    GoogleSheetsService,
    GoogleDriveService,
    BitrixService,
  ],
})
export class MasterclassModule {}
