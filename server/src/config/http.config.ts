import { RequestMethod } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { isProduction, parseAllowedOrigins } from './environment';

type Environment = Record<string, string | undefined>;

const DEVELOPMENT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export const GLOBAL_PREFIX_EXCLUSIONS = [
  { path: 'health', method: RequestMethod.GET },
  { path: 'health/ready', method: RequestMethod.GET },
];

export function allowedCorsOrigins(environment: Environment): string[] {
  const configured = parseAllowedOrigins(environment.CLIENT_URL);
  if (configured.length) return configured;
  return isProduction(environment) ? [] : DEVELOPMENT_ORIGINS;
}

export function createCorsOptions(environment: Environment): CorsOptions {
  const allowedOrigins = new Set(allowedCorsOrigins(environment));

  return {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed by CORS.'));
    },
    credentials: true,
  };
}

export function shouldTrustPlatformProxy(environment: Environment): boolean {
  return isProduction(environment);
}

export function resolvePort(environment: Environment): number {
  return Number(environment.PORT ?? 3000);
}
