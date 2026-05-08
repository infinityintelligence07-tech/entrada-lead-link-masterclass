import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module';
import { MasterclassModule } from './masterclass/masterclass.module';
import { GoogleOauthModule } from './google-oauth/google-oauth.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    MasterclassModule,
    GoogleOauthModule,
  ],
})
export class AppModule {}
