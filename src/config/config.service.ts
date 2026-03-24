import { Injectable } from '@nestjs/common';
import { AppEnv, loadEnv } from './env';

@Injectable()
export class ConfigService {
  private readonly env: AppEnv = loadEnv();

  get values(): AppEnv {
    return this.env;
  }
}
