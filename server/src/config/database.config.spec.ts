import {
  createApplicationDatabaseOptions,
  createMigrationDatabaseOptions,
} from './database.config';

const certificate = Buffer.from(
  '-----BEGIN CERTIFICATE-----\ntest-ca\n-----END CERTIFICATE-----',
).toString('base64');

const productionEnvironment = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:password@db.example.com/postgres',
  DATABASE_SSL_CA_BASE64: certificate,
  TYPEORM_SYNC: 'false',
  TYPEORM_RUN_MIGRATIONS: 'false',
};

const renderInternalProductionEnvironment = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:password@dpg-cabcdefghijklmnop-a/postgres',
  TYPEORM_SYNC: 'false',
  TYPEORM_RUN_MIGRATIONS: 'false',
};

function sslOption(options: unknown): unknown {
  return (options as { ssl?: unknown }).ssl;
}

describe('database configuration', () => {
  it('forces production application synchronization and migrations off', () => {
    const options = createApplicationDatabaseOptions(productionEnvironment);

    expect(options).toMatchObject({
      synchronize: false,
      migrationsRun: false,
      ssl: { rejectUnauthorized: true },
    });
  });

  it('disables TLS only for a Render internal PostgreSQL hostname', () => {
    const applicationOptions = createApplicationDatabaseOptions(
      renderInternalProductionEnvironment,
    );
    const migrationOptions = createMigrationDatabaseOptions(
      renderInternalProductionEnvironment,
    );

    expect(applicationOptions).toMatchObject({
      synchronize: false,
      migrationsRun: false,
      ssl: false,
    });
    expect(sslOption(migrationOptions)).toBe(false);
  });

  it('requires verified TLS for an external production database without a custom CA', () => {
    const environment = {
      ...productionEnvironment,
      DATABASE_SSL_CA_BASE64: undefined,
    };

    expect(sslOption(createApplicationDatabaseOptions(environment))).toEqual({
      rejectUnauthorized: true,
    });
    expect(sslOption(createMigrationDatabaseOptions(environment))).toEqual({
      rejectUnauthorized: true,
    });
  });

  it('does not mistake a public Render hostname for an internal hostname', () => {
    const environment = {
      ...renderInternalProductionEnvironment,
      DATABASE_URL:
        'postgresql://user:password@dpg-cabcdefghijklmnop-a.oregon-postgres.render.com/postgres',
    };

    expect(sslOption(createApplicationDatabaseOptions(environment))).toEqual({
      rejectUnauthorized: true,
    });
  });

  it('uses an optional custom CA with strict verification for external production databases', () => {
    const options = createApplicationDatabaseOptions(productionEnvironment);

    expect(sslOption(options)).toEqual({
      rejectUnauthorized: true,
      ca: '-----BEGIN CERTIFICATE-----\ntest-ca\n-----END CERTIFICATE-----',
    });
  });

  it('preserves non-TLS development database behavior', () => {
    const environment = {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://postgres:password@localhost:5432/dcla',
      TYPEORM_SYNC: 'true',
      TYPEORM_RUN_MIGRATIONS: 'false',
    };

    expect(createApplicationDatabaseOptions(environment)).toMatchObject({
      synchronize: true,
      migrationsRun: false,
      ssl: false,
    });
    expect(sslOption(createMigrationDatabaseOptions(environment))).toBe(false);
  });

  it('keeps the migration data source non-synchronizing', () => {
    const options = createMigrationDatabaseOptions(productionEnvironment);

    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(false);
    expect(String(options.migrations?.[0])).toContain('migrations');
    expect(String(options.migrations?.[0])).not.toContain('.spec.');
  });
});
