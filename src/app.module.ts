import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module';
import { MasterclassModule } from './masterclass/masterclass.module';

@Module({
  imports: [ScheduleModule.forRoot(), ConfigModule, MasterclassModule],
})
export class AppModule {}
