import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 4040);
  const host = process.env.HOST ?? '127.0.0.1';
  await app.listen(port, host);
  Logger.log(`HTTP ativo em http://${host}:${port}`, 'Bootstrap');
}

void bootstrap();
