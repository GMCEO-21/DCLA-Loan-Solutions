import { parseDateOnly } from '../common/date-only';
import {
  NEW_LOAN_OVERDUE_CHARGE_POLICY_VERSION,
  OVERDUE_CHARGE_POLICY_ACTIVATION_DATE,
  OVERDUE_CHARGE_POLICY_V1,
} from '../loans/loan-charge-policy.constants';

type Environment = Record<string, string | undefined>;

const PRODUCTION_REQUIRED_VARIABLES = [
  'PORT',
  'DATABASE_URL',
  'DATABASE_SSL_CA_BASE64',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'CLIENT_URL',
] as const;

export function isProduction(environment: Environment): boolean {
  return environment.NODE_ENV?.trim() === 'production';
}

export function isEnabled(value: string | undefined): boolean {
  return value?.trim() === 'true';
}

export function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value?.trim()) return [];

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      let parsed: URL;
      try {
        parsed = new URL(entry);
      } catch {
        throw new Error('CLIENT_URL must contain valid absolute origins.');
      }

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('CLIENT_URL origins must use HTTP or HTTPS.');
      }
      if (
        parsed.username ||
        parsed.password ||
        parsed.pathname !== '/' ||
        parsed.search ||
        parsed.hash
      ) {
        throw new Error(
          'CLIENT_URL must contain origins without paths or credentials.',
        );
      }
      return parsed.origin;
    });
}

export function validateEnvironment(environment: Environment): Environment {
  if (!isProduction(environment)) {
    validateBooleanVariables(environment);
    validateLoanChargeConfiguration(environment);
    if (environment.CLIENT_URL?.trim()) {
      parseAllowedOrigins(environment.CLIENT_URL);
    }
    return environment;
  }

  const missing = PRODUCTION_REQUIRED_VARIABLES.filter(
    (key) => !environment[key]?.trim(),
  );
  if (missing.length) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(', ')}.`,
    );
  }

  validateBooleanVariables(environment);
  validateLoanChargeConfiguration(environment);
  validatePort(environment.PORT);
  validateDatabaseUrl(environment.DATABASE_URL, true);
  validateCertificate(environment.DATABASE_SSL_CA_BASE64);

  const origins = parseAllowedOrigins(environment.CLIENT_URL);
  if (origins.some((origin) => !origin.startsWith('https://'))) {
    throw new Error('CLIENT_URL origins must use HTTPS in production.');
  }

  if (isEnabled(environment.TYPEORM_SYNC)) {
    throw new Error('TYPEORM_SYNC cannot be true in production.');
  }
  if (isEnabled(environment.TYPEORM_RUN_MIGRATIONS)) {
    throw new Error(
      'TYPEORM_RUN_MIGRATIONS cannot be true in production; use the pre-deploy migration command.',
    );
  }

  if (
    isEnabled(environment.SMS_WORKER_ENABLED) &&
    !isEnabled(environment.SMS_ENABLED)
  ) {
    throw new Error('SMS_WORKER_ENABLED requires SMS_ENABLED=true.');
  }
  if (isEnabled(environment.SMS_ENABLED)) {
    const missingSms = ['UNISMS_API_SECRET', 'UNISMS_SENDER_ID'].filter(
      (key) => !environment[key]?.trim(),
    );
    if (missingSms.length) {
      throw new Error(
        `Missing required SMS environment variables: ${missingSms.join(', ')}.`,
      );
    }
  }

  return environment;
}

export function validateDatabaseEnvironment(environment: Environment): void {
  if (!environment.DATABASE_URL?.trim()) {
    if (isProduction(environment)) {
      throw new Error('DATABASE_URL is required in production.');
    }
    return;
  }

  const production = isProduction(environment);
  validateDatabaseUrl(environment.DATABASE_URL, production);
  if (production) {
    validateCertificate(environment.DATABASE_SSL_CA_BASE64);
    if (isEnabled(environment.TYPEORM_SYNC)) {
      throw new Error('TYPEORM_SYNC cannot be true in production.');
    }
  }
}

export function decodeDatabaseCa(
  value: string | undefined,
): string | undefined {
  if (!value?.trim()) return undefined;

  const certificate = Buffer.from(value.trim(), 'base64')
    .toString('utf8')
    .trim();
  if (
    !certificate.startsWith('-----BEGIN CERTIFICATE-----') ||
    !certificate.endsWith('-----END CERTIFICATE-----')
  ) {
    throw new Error(
      'DATABASE_SSL_CA_BASE64 must contain a base64-encoded PEM certificate.',
    );
  }
  return certificate;
}

function validateBooleanVariables(environment: Environment): void {
  for (const key of [
    'TYPEORM_SYNC',
    'TYPEORM_RUN_MIGRATIONS',
    'SMS_ENABLED',
    'SMS_WORKER_ENABLED',
    'LOAN_CHARGE_SCHEDULER_ENABLED',
  ]) {
    const value = environment[key]?.trim();
    if (value && value !== 'true' && value !== 'false') {
      throw new Error(`${key} must be true or false.`);
    }
  }
}

function validateLoanChargeConfiguration(environment: Environment): void {
  const version = environment[NEW_LOAN_OVERDUE_CHARGE_POLICY_VERSION]?.trim();
  const activationDate =
    environment[OVERDUE_CHARGE_POLICY_ACTIVATION_DATE]?.trim();

  if (Boolean(version) !== Boolean(activationDate)) {
    throw new Error(
      `${NEW_LOAN_OVERDUE_CHARGE_POLICY_VERSION} and ${OVERDUE_CHARGE_POLICY_ACTIVATION_DATE} must be configured together.`,
    );
  }
  if (version && version !== OVERDUE_CHARGE_POLICY_V1) {
    throw new Error(
      `${NEW_LOAN_OVERDUE_CHARGE_POLICY_VERSION} must be ${OVERDUE_CHARGE_POLICY_V1}.`,
    );
  }
  if (activationDate) {
    try {
      parseDateOnly(activationDate);
    } catch {
      throw new Error(
        `${OVERDUE_CHARGE_POLICY_ACTIVATION_DATE} must use a valid YYYY-MM-DD date.`,
      );
    }
  }

  if (isEnabled(environment.LOAN_CHARGE_SCHEDULER_ENABLED) && !version) {
    throw new Error(
      'LOAN_CHARGE_SCHEDULER_ENABLED requires an active new-loan charge policy.',
    );
  }

  validatePositiveInteger(
    environment.LOAN_CHARGE_POLL_INTERVAL_MS,
    'LOAN_CHARGE_POLL_INTERVAL_MS',
  );
  validatePositiveInteger(
    environment.LOAN_CHARGE_BATCH_SIZE,
    'LOAN_CHARGE_BATCH_SIZE',
  );
}

function validatePositiveInteger(value: string | undefined, key: string): void {
  if (!value?.trim()) return;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }
}

function validatePort(value: string | undefined): void {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
}

function validateDatabaseUrl(
  value: string | undefined,
  production = false,
): void {
  let parsed: URL;
  try {
    parsed = new URL(value ?? '');
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use the PostgreSQL protocol.');
  }

  const sslMode = parsed.searchParams.get('sslmode');
  if (
    sslMode &&
    ['disable', 'allow', 'prefer', 'no-verify'].includes(sslMode)
  ) {
    throw new Error(
      'DATABASE_URL cannot disable TLS certificate verification.',
    );
  }
  if (
    production &&
    ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert'].some((key) =>
      parsed.searchParams.has(key),
    )
  ) {
    throw new Error(
      'DATABASE_URL must not contain SSL query parameters in production; use DATABASE_SSL_CA_BASE64.',
    );
  }
}

function validateCertificate(value: string | undefined): void {
  decodeDatabaseCa(value);
}
