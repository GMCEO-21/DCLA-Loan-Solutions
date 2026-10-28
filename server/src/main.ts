import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Express } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import {
  createCorsOptions,
  GLOBAL_PREFIX_EXCLUSIONS,
  resolvePort,
  shouldTrustPlatformProxy,
} from './config/http.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  if (shouldTrustPlatformProxy(process.env)) {
    const express = app.getHttpAdapter().getInstance() as Express;
    express.set('trust proxy', 1);
  }

  app.enableCors(createCorsOptions(process.env));
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api', { exclude: GLOBAL_PREFIX_EXCLUSIONS });
  app.enableShutdownHooks();
  await app.listen(resolvePort(process.env), '0.0.0.0');
}

void bootstrap();
