import { decodeDatabaseCa, validateEnvironment } from './environment';

const certificate = Buffer.from(
  '-----BEGIN CERTIFICATE-----\ntest-ca\n-----END CERTIFICATE-----',
).toString('base64');

function productionEnvironment() {
  return {
    NODE_ENV: 'production',
    PORT: '10000',
    DATABASE_URL: 'postgresql://user:private-password@db.example.com/postgres',
    DATABASE_SSL_CA_BASE64: certificate,
    JWT_SECRET: 'private-access-secret',
    JWT_REFRESH_SECRET: 'private-refresh-secret',
    CLIENT_URL: 'https://app.example.com',
    TYPEORM_SYNC: 'false',
    TYPEORM_RUN_MIGRATIONS: 'false',
    SMS_ENABLED: 'false',
    SMS_WORKER_ENABLED: 'false',
    LOAN_CHARGE_SCHEDULER_ENABLED: 'false',
  };
}

describe('validateEnvironment', () => {
  it('accepts a complete production environment', () => {
    const environment = productionEnvironment();
    expect(validateEnvironment(environment)).toBe(environment);
  });

  it('accepts production without a custom database CA', () => {
    const environment = productionEnvironment();
    delete (environment as Partial<typeof environment>).DATABASE_SSL_CA_BASE64;

    expect(validateEnvironment(environment)).toBe(environment);
  });

  it('accepts a Render internal PostgreSQL URL without a custom CA', () => {
    const environment = {
      ...productionEnvironment(),
      DATABASE_URL:
        'postgresql://user:private-password@dpg-cabcdefghijklmnop-a/postgres',
      DATABASE_SSL_CA_BASE64: undefined,
    };

    expect(validateEnvironment(environment)).toBe(environment);
  });

  it('rejects an invalid optional database CA', () => {
    const environment = {
      ...productionEnvironment(),
      DATABASE_SSL_CA_BASE64:
        Buffer.from('not-a-certificate').toString('base64'),
    };

    expect(() => validateEnvironment(environment)).toThrow(
      'DATABASE_SSL_CA_BASE64 must contain a base64-encoded PEM certificate.',
    );
  });

  it('fails closed when CLIENT_URL is missing in production', () => {
    const environment = productionEnvironment();
    delete (environment as Partial<typeof environment>).CLIENT_URL;

    expect(() => validateEnvironment(environment)).toThrow('CLIENT_URL');
  });

  it('refuses TypeORM synchronization in production', () => {
    const environment = { ...productionEnvironment(), TYPEORM_SYNC: 'true' };
    expect(() => validateEnvironment(environment)).toThrow(
      'TYPEORM_SYNC cannot be true in production.',
    );
  });

  it('rejects database URL options that could override verified TLS', () => {
    const environment = {
      ...productionEnvironment(),
      DATABASE_URL:
        'postgresql://user:private-password@db.example.com/postgres?sslmode=require',
    };

    expect(() => validateEnvironment(environment)).toThrow(
      'DATABASE_URL must not contain SSL query parameters in production',
    );
  });

  it('does not reveal secret values in validation errors', () => {
    const environment = {
      ...productionEnvironment(),
      CLIENT_URL: 'not-an-origin',
    };

    expect(() => validateEnvironment(environment)).toThrow('CLIENT_URL');
    try {
      validateEnvironment(environment);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain('private-password');
      expect(message).not.toContain('private-access-secret');
      expect(message).not.toContain('private-refresh-secret');
    }
  });

  it('requires the overdue policy version and activation date together', () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment(),
        NEW_LOAN_OVERDUE_CHARGE_POLICY_VERSION: 'DCLA_2026_V1',
      }),
    ).toThrow('must be configured together');
  });

  it('accepts the supported overdue policy with a valid activation date', () => {
    const environment = {
      ...productionEnvironment(),
      NEW_LOAN_OVERDUE_CHARGE_POLICY_VERSION: 'DCLA_2026_V1',
      OVERDUE_CHARGE_POLICY_ACTIVATION_DATE: '2026-10-01',
    };
    expect(validateEnvironment(environment)).toBe(environment);
  });

  it('rejects invalid loan charge worker configuration', () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment(),
        LOAN_CHARGE_BATCH_SIZE: '0',
      }),
    ).toThrow('LOAN_CHARGE_BATCH_SIZE must be a positive integer');
  });

  it('does not allow the charge worker without controlled enrollment', () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment(),
        LOAN_CHARGE_SCHEDULER_ENABLED: 'true',
      }),
    ).toThrow('requires an active new-loan charge policy');
  });
});

describe('decodeDatabaseCa', () => {
  it('decodes a base64 PEM certificate', () => {
    expect(decodeDatabaseCa(certificate)).toContain('BEGIN CERTIFICATE');
  });
});
