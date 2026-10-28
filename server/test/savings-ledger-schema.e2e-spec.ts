import { randomUUID } from 'crypto';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { Center } from '../src/centers/entities/center.entity';
import { Collection } from '../src/collections/entities/collection.entity';
import { LoanWaiver } from '../src/loans/entities/loan-waiver.entity';
import { Loan } from '../src/loans/loan.entity';
import { Member } from '../src/members/entities/member.entity';
import { AddSavingsLedgerFoundation1763400000000 } from '../src/migrations/1763400000000-AddSavingsLedgerFoundation';
import { AddSavingsHistoryIndexes1763500000000 } from '../src/migrations/1763500000000-AddSavingsHistoryIndexes';
import { Role } from '../src/roles/role.entity';
import { CollectionBatch } from '../src/repayments/entities/collection-batch.entity';
import { LoanRepaymentAllocation } from '../src/repayments/entities/loan-repayment-allocation.entity';
import { LoanRepaymentSchedule } from '../src/repayments/entities/loan-repayment-schedule.entity';
import { Repayment } from '../src/repayments/repayment.entity';
import { Savings, SavingsEventType } from '../src/savings/savings.entity';
import { User } from '../src/users/user.entity';

jest.setTimeout(30_000);

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const schemaTestsEnabled =
  process.env.RUN_SAVINGS_LEDGER_SCHEMA_TESTS === 'true';

if (schemaTestsEnabled && !testDatabaseUrl) {
  throw new Error(
    'RUN_SAVINGS_LEDGER_SCHEMA_TESTS requires an isolated TEST_DATABASE_URL',
  );
}

const describeWithPostgres =
  schemaTestsEnabled && testDatabaseUrl ? describe : describe.skip;

describeWithPostgres('Savings ledger migration against real PostgreSQL', () => {
  const schema = `savings_ledger_schema_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;
  const migration = new AddSavingsLedgerFoundation1763400000000();
  const historyIndexMigration = new AddSavingsHistoryIndexes1763500000000();
  const legacyId = randomUUID();
  const memberId = randomUUID();
  const actorId = randomUUID();
  let adminDataSource: DataSource;
  let entityDataSource: DataSource;
  let queryRunner: QueryRunner;
  let savingsRepository: Repository<Savings>;
  let migrationApplied = false;
  let historyIndexMigrationApplied = false;

  const entityClasses = [
    Center,
    Member,
    Loan,
    LoanWaiver,
    Savings,
    Collection,
    Repayment,
    CollectionBatch,
    LoanRepaymentSchedule,
    LoanRepaymentAllocation,
    Role,
    User,
  ];

  function createSavings(values: Partial<Savings> = {}) {
    return savingsRepository.create({
      id: randomUUID(),
      borrower: { id: memberId } as Member,
      loan: null,
      amount: 100,
      remarks: 'Schema compatibility test',
      ...values,
    });
  }

  async function expectPostgresError(
    operation: Promise<unknown>,
    expectedCode: '23503' | '23505',
  ) {
    try {
      await operation;
      throw new Error(`Expected PostgreSQL error ${expectedCode}`);
    } catch (error) {
      const postgresError = error as {
        code?: string;
        driverError?: { code?: string };
      };
      expect(postgresError.driverError?.code ?? postgresError.code).toBe(
        expectedCode,
      );
    }
  }

  beforeAll(async () => {
    if (!/^savings_ledger_schema_\d+_[0-9a-f]+$/.test(schema)) {
      throw new Error('Unsafe ledger-schema test name');
    }

    adminDataSource = new DataSource({
      type: 'postgres',
      url: testDatabaseUrl,
    });
    await adminDataSource.initialize();
    queryRunner = adminDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.query(`CREATE SCHEMA "${schema}"`);
    await queryRunner.query(`SET search_path TO "${schema}"`);
    await queryRunner.query(`CREATE TABLE "user" ("id" uuid PRIMARY KEY)`);
    await queryRunner.query(`
      CREATE TABLE "savings" (
        "id" uuid NOT NULL PRIMARY KEY,
        "borrowerId" uuid NOT NULL,
        "loanId" uuid,
        "amount" numeric(12,2) NOT NULL,
        "remarks" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `INSERT INTO "savings"
        ("id", "borrowerId", "amount", "remarks", "createdAt", "updatedAt")
       VALUES ($1, $2, -125.50, 'Legacy debit',
        TIMESTAMP '2025-01-02 03:04:05', TIMESTAMP '2025-01-02 03:04:05')`,
      [legacyId, memberId],
    );

    await migration.up(queryRunner);
    migrationApplied = true;
    await historyIndexMigration.up(queryRunner);
    historyIndexMigrationApplied = true;

    entityDataSource = new DataSource({
      type: 'postgres',
      url: testDatabaseUrl,
      schema,
      synchronize: false,
      entities: entityClasses,
    });
    await entityDataSource.initialize();
    savingsRepository = entityDataSource.getRepository(Savings);
  });

  afterAll(async () => {
    if (entityDataSource?.isInitialized) {
      await entityDataSource.destroy();
    }
    if (queryRunner?.isReleased === false) {
      await queryRunner.query(`SET search_path TO "${schema}"`);
      if (historyIndexMigrationApplied) {
        await historyIndexMigration.down(queryRunner);
      }
      if (migrationApplied) {
        await migration.down(queryRunner);
      }
      await queryRunner.query('SET search_path TO public');
      await queryRunner.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await queryRunner.release();
    }
    if (adminDataSource?.isInitialized) {
      await adminDataSource.destroy();
    }
  });

  it('creates separate partial indexes for ledger and legacy history', async () => {
    const indexes = (await queryRunner.query(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = $1
         AND indexname IN (
           'IDX_savings_ledger_history',
           'IDX_savings_legacy_history'
         )
       ORDER BY indexname`,
      [schema],
    )) as Array<{ indexname: string; indexdef: string }>;

    expect(indexes.map((index) => index.indexname)).toEqual([
      'IDX_savings_ledger_history',
      'IDX_savings_legacy_history',
    ]);
    expect(indexes[0].indexdef).toMatch(
      /\("borrowerId", "createdAt", id\).*\("eventType" IS NOT NULL\)/,
    );
    expect(indexes[1].indexdef).toMatch(
      /\("borrowerId", "createdAt", id\).*\("eventType" IS NULL\)/,
    );
  });

  it('preserves existing rows and accepts legacy-style entity inserts', async () => {
    const legacyResult: unknown = await queryRunner.query(
      `SELECT *,
        to_char("createdAt", 'YYYY-MM-DD HH24:MI:SS') AS "createdAtText",
        to_char("updatedAt", 'YYYY-MM-DD HH24:MI:SS') AS "updatedAtText"
       FROM "savings" WHERE "id" = $1`,
      [legacyId],
    );
    const [legacy] = legacyResult as Array<
      Record<string, string | Date | null>
    >;

    expect(legacy).toEqual(
      expect.objectContaining({
        id: legacyId,
        borrowerId: memberId,
        amount: '-125.50',
        remarks: 'Legacy debit',
        eventType: null,
        balanceBefore: null,
        balanceAfter: null,
        businessDate: null,
        referenceType: null,
        referenceId: null,
        idempotencyKey: null,
        performedById: null,
        reversalOfId: null,
      }),
    );
    expect(legacy.createdAtText).toBe('2025-01-02 03:04:05');
    expect(legacy.updatedAtText).toBe('2025-01-02 03:04:05');

    const inserted = await savingsRepository.save(createSavings());
    const persisted = await savingsRepository.findOneByOrFail({
      id: inserted.id,
    });
    expect(persisted.eventType).toBeNull();
    expect(persisted.balanceBefore).toBeNull();
    expect(persisted.idempotencyKey).toBeNull();
  });

  it('persists a future complete ledger-style entity row', async () => {
    await queryRunner.query(`INSERT INTO "user" ("id") VALUES ($1)`, [actorId]);
    const referenceId = randomUUID();
    const inserted = await savingsRepository.save(
      createSavings({
        eventType: SavingsEventType.MANUAL_DEPOSIT,
        amount: 500,
        balanceBefore: 1000,
        balanceAfter: 1500,
        businessDate: '2026-09-03',
        referenceType: 'loan',
        referenceId,
        idempotencyKey: `schema-test:${randomUUID()}`,
        performedById: actorId,
      }),
    );
    const persisted = await savingsRepository.findOneByOrFail({
      id: inserted.id,
    });

    expect(persisted).toEqual(
      expect.objectContaining({
        eventType: SavingsEventType.MANUAL_DEPOSIT,
        businessDate: '2026-09-03',
        referenceType: 'loan',
        referenceId,
        performedById: actorId,
      }),
    );
    expect(Number(persisted.balanceBefore)).toBe(1000);
    expect(Number(persisted.balanceAfter)).toBe(1500);

    await queryRunner.query(`DELETE FROM "user" WHERE "id" = $1`, [actorId]);
    const retained = await savingsRepository.findOneByOrFail({
      id: inserted.id,
    });
    expect(retained.performedById).toBeNull();
  });

  it('allows NULL and distinct keys but rejects duplicate idempotency keys', async () => {
    await savingsRepository.save([createSavings(), createSavings()]);
    await savingsRepository.save(
      createSavings({ idempotencyKey: `key:${randomUUID()}` }),
    );
    const duplicateKey = `duplicate:${randomUUID()}`;
    await savingsRepository.save(
      createSavings({ idempotencyKey: duplicateKey }),
    );

    await expectPostgresError(
      savingsRepository.save(createSavings({ idempotencyKey: duplicateKey })),
      '23505',
    );
  });

  it('enforces unique and referentially intact reversal links', async () => {
    await savingsRepository.save([createSavings(), createSavings()]);
    const original = await savingsRepository.save(createSavings());
    await savingsRepository.save(createSavings({ reversalOfId: original.id }));

    await expectPostgresError(
      savingsRepository.save(createSavings({ reversalOfId: original.id })),
      '23505',
    );
    await expectPostgresError(
      savingsRepository.save(createSavings({ reversalOfId: randomUUID() })),
      '23503',
    );
    await expectPostgresError(
      queryRunner.query(`DELETE FROM "savings" WHERE "id" = $1`, [original.id]),
      '23503',
    );
  });
});
