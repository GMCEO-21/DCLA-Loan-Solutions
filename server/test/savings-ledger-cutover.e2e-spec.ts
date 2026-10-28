import { DataSource, Repository } from 'typeorm';
import { Center } from '../src/centers/entities/center.entity';
import { Collection } from '../src/collections/entities/collection.entity';
import { LoanWaiver } from '../src/loans/entities/loan-waiver.entity';
import { Loan } from '../src/loans/loan.entity';
import { LoansService } from '../src/loans/loans.service';
import { Member } from '../src/members/entities/member.entity';
import { CollectionBatch } from '../src/repayments/entities/collection-batch.entity';
import { LoanRepaymentAllocation } from '../src/repayments/entities/loan-repayment-allocation.entity';
import { LoanRepaymentSchedule } from '../src/repayments/entities/loan-repayment-schedule.entity';
import { Repayment } from '../src/repayments/repayment.entity';
import { Role } from '../src/roles/role.entity';
import {
  SAVINGS_OPENING_CONFIRMATION,
  SAVINGS_OPENING_REMARKS,
  SavingsLedgerCutoverBlockedError,
  SavingsLedgerCutoverService,
  savingsOpeningIdempotencyKey,
} from '../src/savings/savings-ledger-cutover.service';
import { Savings, SavingsEventType } from '../src/savings/savings.entity';
import { executeSavingsLedgerCutoverCommand } from '../src/scripts/savings-ledger-cutover';
import { User } from '../src/users/user.entity';

jest.setTimeout(30_000);

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const cutoverEnabled = process.env.RUN_SAVINGS_LEDGER_CUTOVER_TESTS === 'true';

if (cutoverEnabled && !testDatabaseUrl) {
  throw new Error(
    'RUN_SAVINGS_LEDGER_CUTOVER_TESTS requires an isolated TEST_DATABASE_URL',
  );
}

const describeWithPostgres =
  cutoverEnabled && testDatabaseUrl ? describe : describe.skip;

describeWithPostgres('Savings ledger cutover against real PostgreSQL', () => {
  const schema = `savings_ledger_cutover_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;
  const testEntities = [
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
  const cutoverAt = new Date('2026-09-03T16:30:00.000Z');
  let adminDataSource: DataSource;
  let dataSource: DataSource;
  let memberRepository: Repository<Member>;
  let loanRepository: Repository<Loan>;
  let savingsRepository: Repository<Savings>;
  let cutoverService: SavingsLedgerCutoverService;

  const table = (name: string) => `"${schema}"."${name}"`;

  beforeAll(async () => {
    if (!/^savings_ledger_cutover_\d+_[0-9a-f]+$/.test(schema)) {
      throw new Error('Unsafe savings-ledger-cutover test schema name');
    }

    adminDataSource = new DataSource({
      type: 'postgres',
      url: testDatabaseUrl,
    });
    await adminDataSource.initialize();
    await adminDataSource.query(`CREATE SCHEMA "${schema}"`);

    dataSource = new DataSource({
      type: 'postgres',
      url: testDatabaseUrl,
      schema,
      synchronize: true,
      entities: testEntities,
    });
    await dataSource.initialize();

    for (const entity of testEntities) {
      const metadata = dataSource.getMetadata(entity);
      if (
        metadata.schema !== schema ||
        !metadata.tablePath.startsWith(`${schema}.`)
      ) {
        throw new Error(
          `Entity ${metadata.name} resolved outside isolated schema ${schema}`,
        );
      }
    }

    memberRepository = dataSource.getRepository(Member);
    loanRepository = dataSource.getRepository(Loan);
    savingsRepository = dataSource.getRepository(Savings);
    const loansService = new LoansService(
      loanRepository,
      memberRepository,
      dataSource.getRepository(Collection),
      savingsRepository,
      dataSource.getRepository(LoanRepaymentSchedule),
      dataSource.getRepository(LoanWaiver),
    );
    cutoverService = new SavingsLedgerCutoverService(
      dataSource,
      memberRepository,
      savingsRepository,
      loansService,
    );
  }, 90_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    if (adminDataSource?.isInitialized) {
      await adminDataSource.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      const [remainingSchema] = await adminDataSource.query<
        Array<{ exists: boolean }>
      >(
        'SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1) AS "exists"',
        [schema],
      );
      expect(remainingSchema?.exists).toBe(false);
      await adminDataSource.destroy();
    }
  });

  beforeEach(async () => {
    await dataSource.query(
      `DROP TRIGGER IF EXISTS "fail_test_opening" ON ${table('savings')}`,
    );
    await dataSource.query(
      `DROP FUNCTION IF EXISTS "${schema}"."fail_test_opening"()`,
    );
    await dataSource.query(
      `TRUNCATE TABLE ${table('member')} RESTART IDENTITY CASCADE`,
    );
  });

  async function createMember(label: string): Promise<Member> {
    return memberRepository.save(
      memberRepository.create({
        firstName: label,
        middleName: 'Cutover',
        lastName: 'Test',
        contactNumber: `09${Math.floor(Math.random() * 1_000_000_000)
          .toString()
          .padStart(9, '0')}`,
        address: 'Isolated schema',
        center: null,
        centerId: null,
      }),
    );
  }

  async function createLoan(
    borrower: Member,
    savings: number,
    status: Loan['status'] = 'active',
    createdAt?: Date,
  ): Promise<Loan> {
    const loan = await loanRepository.save(
      loanRepository.create({
        borrower,
        principalAmount: 10_000,
        termWeeks: 4,
        interestRate: 10,
        status,
        weeklyPaymentAmount: 2_750,
        amountPaid: status === 'active' ? 0 : 11_000,
        balance: status === 'active' ? 11_000 : 0,
        advancePaymentBuffer: 0,
        totalAmount: 11_000,
        serviceCharge: 0,
        notarialFee: 0,
        savings,
        existingSavings: 0,
        weeksPaid: status === 'active' ? 0 : 4,
        paymentCountDisplayOffset: 0,
        netCashReleased: null,
        pastDueInterestAccrued: 0,
        pastDueInterestWaived: 0,
        penaltyAccrued: 0,
        penaltyWaived: 0,
        loanCreatedDate: createdAt ?? new Date(),
      }),
    );

    if (createdAt) {
      await loanRepository.update(loan.id, { createdAt });
      loan.createdAt = createdAt;
    }
    return loan;
  }

  async function createLegacyEntry(
    borrower: Member,
    loan: Loan | null,
    amount = 125,
  ): Promise<Savings> {
    return savingsRepository.save(
      savingsRepository.create({
        borrower,
        loan,
        amount,
        remarks: 'Preserved legacy evidence',
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
  }

  async function createCompleteEntry(
    borrower: Member,
    loan: Loan,
    amount: number,
    balanceBefore: number,
    balanceAfter: number,
  ): Promise<Savings> {
    return savingsRepository.save(
      savingsRepository.create({
        borrower,
        loan,
        amount,
        remarks: 'Complete ledger movement',
        eventType: SavingsEventType.MANUAL_DEPOSIT,
        balanceBefore,
        balanceAfter,
        businessDate: '2026-09-04',
        referenceType: null,
        referenceId: null,
        idempotencyKey: null,
        performedById: null,
        reversalOfId: null,
      }),
    );
  }

  async function openingsFor(memberId: string): Promise<Savings[]> {
    return savingsRepository.find({
      where: {
        borrowerId: memberId,
        eventType: SavingsEventType.OPENING_BALANCE,
      },
      relations: { loan: true },
    });
  }

  it('creates active, latest-historical, carry-forward, and zero openings from only the authoritative loan', async () => {
    const activeMember = await createMember('Active');
    const activeLoan = await createLoan(activeMember, 5_000);

    const historicalMember = await createMember('Historical');
    await createLoan(
      historicalMember,
      1_000,
      'paid',
      new Date('2025-01-01T00:00:00.000Z'),
    );
    const latestLoan = await createLoan(
      historicalMember,
      2_500,
      'paid',
      new Date('2026-01-01T00:00:00.000Z'),
    );

    const zeroMember = await createMember('Zero');
    const zeroLoan = await createLoan(zeroMember, 0);

    const result = await cutoverService.run({ apply: true, at: cutoverAt });

    expect(result.created).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.businessDate).toBe('2026-09-04');
    expect(result.preflight.summary.zeroBalanceOpenings).toBe(1);

    const expectations = [
      [activeMember, activeLoan, '5000.00'],
      [historicalMember, latestLoan, '2500.00'],
      [zeroMember, zeroLoan, '0.00'],
    ] as const;
    for (const [member, loan, amount] of expectations) {
      const [opening] = await openingsFor(member.id);
      expect(String(opening.amount)).toBe(amount);
      expect(String(opening.balanceBefore)).toBe('0.00');
      expect(String(opening.balanceAfter)).toBe(amount);
      expect(opening.loan?.id).toBe(loan.id);
      expect(opening.businessDate).toBe('2026-09-04');
      expect(opening.idempotencyKey).toBe(
        savingsOpeningIdempotencyKey(member.id),
      );
      expect(opening.performedById).toBeNull();
      expect(opening.referenceType).toBeNull();
      expect(opening.referenceId).toBeNull();
      expect(opening.reversalOfId).toBeNull();
      expect(opening.remarks).toBe(SAVINGS_OPENING_REMARKS);
    }

    expect(
      String(
        (await loanRepository.findOneByOrFail({ id: activeLoan.id })).savings,
      ),
    ).toBe('5000.00');
    expect(
      String(
        (await loanRepository.findOneByOrFail({ id: latestLoan.id })).savings,
      ),
    ).toBe('2500.00');
    expect(
      String(
        (await loanRepository.findOneByOrFail({ id: zeroLoan.id })).savings,
      ),
    ).toBe('0.00');
  });

  it('reports no-loan members, financial evidence without a loan, and invalid negative balances without writing', async () => {
    await createMember('NoLoan');
    const evidenceMember = await createMember('EvidenceNoLoan');
    await createLegacyEntry(evidenceMember, null);
    const negativeMember = await createMember('Negative');
    await createLoan(negativeMember, -10);

    const dryRun = await cutoverService.run({ at: cutoverAt });

    expect(dryRun.preflight.summary.noAuthoritativeLoan).toBe(1);
    expect(dryRun.preflight.summary.financialEvidenceWithoutLoan).toBe(1);
    expect(dryRun.preflight.summary.invalidAuthoritativeSavings).toBe(1);
    expect(dryRun.preflight.summary.blockers).toBe(2);
    await expect(
      cutoverService.run({ apply: true, at: cutoverAt }),
    ).rejects.toBeInstanceOf(SavingsLedgerCutoverBlockedError);
    expect(
      await savingsRepository.count({
        where: { eventType: SavingsEventType.OPENING_BALANCE },
      }),
    ).toBe(0);
  });

  it('blocks multiple active loans and tied latest historical loans without arbitrary selection', async () => {
    const activeMember = await createMember('AmbiguousActive');
    await createLoan(activeMember, 100);
    await createLoan(activeMember, 200);

    const tiedMember = await createMember('TiedLatest');
    const tiedAt = new Date('2026-01-01T00:00:00.000Z');
    await createLoan(tiedMember, 300, 'paid', tiedAt);
    await createLoan(tiedMember, 400, 'paid', tiedAt);

    const dryRun = await cutoverService.run({ at: cutoverAt });

    expect(dryRun.preflight.summary.ambiguousAuthoritativeLoan).toBe(2);
    expect(
      dryRun.preflight.members.map((member) => member.blockerCode),
    ).toEqual(
      expect.arrayContaining(['multiple_active_loans', 'latest_loan_tie']),
    );
    await expect(
      cutoverService.run({ apply: true, at: cutoverAt }),
    ).rejects.toBeInstanceOf(SavingsLedgerCutoverBlockedError);
    expect(await savingsRepository.count()).toBe(0);
  });

  it('leaves legacy rows byte-equivalent and adds only the opening row', async () => {
    const member = await createMember('Legacy');
    const loan = await createLoan(member, 750);
    const legacy = await createLegacyEntry(member, loan);
    const [before] = await dataSource.query<Array<Record<string, unknown>>>(
      `SELECT * FROM ${table('savings')} WHERE "id" = $1`,
      [legacy.id],
    );

    await cutoverService.run({ apply: true, at: cutoverAt });

    const [after] = await dataSource.query<Array<Record<string, unknown>>>(
      `SELECT * FROM ${table('savings')} WHERE "id" = $1`,
      [legacy.id],
    );
    expect(after).toEqual(before);
    expect(
      await savingsRepository.count({ where: { borrowerId: member.id } }),
    ).toBe(2);
  });

  it('is idempotent after later ledger movements and never derives the opening from the evolved balance', async () => {
    const member = await createMember('Rerun');
    const loan = await createLoan(member, 5_000);

    const first = await cutoverService.run({ apply: true, at: cutoverAt });
    await createCompleteEntry(member, loan, 500, 5_000, 5_500);
    await loanRepository.update(loan.id, { savings: 5_500 });
    const second = await cutoverService.run({
      apply: true,
      at: new Date('2026-09-05T00:00:00.000Z'),
    });

    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(second.alreadyCutOver).toBe(1);
    const openings = await openingsFor(member.id);
    expect(openings).toHaveLength(1);
    expect(String(openings[0].amount)).toBe('5000.00');
  });

  it('blocks complete ledger rows that exist before any opening', async () => {
    const member = await createMember('PreOpening');
    const loan = await createLoan(member, 1_100);
    await createCompleteEntry(member, loan, 100, 1_000, 1_100);

    const dryRun = await cutoverService.run({ at: cutoverAt });

    expect(dryRun.preflight.summary.preOpeningLedgerBlockers).toBe(1);
    await expect(
      cutoverService.run({ apply: true, at: cutoverAt }),
    ).rejects.toBeInstanceOf(SavingsLedgerCutoverBlockedError);
    expect(await openingsFor(member.id)).toHaveLength(0);
  });

  it('flags a suspicious opening and does not create a second opening', async () => {
    const member = await createMember('Suspicious');
    const loan = await createLoan(member, 900);
    await savingsRepository.save(
      savingsRepository.create({
        borrower: member,
        loan,
        amount: 900,
        remarks: SAVINGS_OPENING_REMARKS,
        eventType: SavingsEventType.OPENING_BALANCE,
        balanceBefore: 0,
        balanceAfter: 900,
        businessDate: '2026-09-04',
        referenceType: null,
        referenceId: null,
        idempotencyKey: 'unexpected-opening-key',
        performedById: null,
        reversalOfId: null,
      }),
    );

    const dryRun = await cutoverService.run({ at: cutoverAt });

    expect(dryRun.preflight.summary.suspiciousOpenings).toBe(1);
    await expect(
      cutoverService.run({ apply: true, at: cutoverAt }),
    ).rejects.toBeInstanceOf(SavingsLedgerCutoverBlockedError);
    expect(await openingsFor(member.id)).toHaveLength(1);
  });

  it('serializes concurrent apply attempts and persists exactly one opening', async () => {
    const member = await createMember('Concurrent');
    await createLoan(member, 1_250);

    const results = await Promise.all([
      cutoverService.run({ apply: true, at: cutoverAt }),
      cutoverService.run({ apply: true, at: cutoverAt }),
    ]);

    expect(results.reduce((sum, result) => sum + result.created, 0)).toBe(1);
    expect(results.reduce((sum, result) => sum + result.failed, 0)).toBe(0);
    expect(await openingsFor(member.id)).toHaveLength(1);
  });

  it('retains completed member transactions after failure and safely completes a rerun', async () => {
    const firstMember = await createMember('PartialA');
    const secondMember = await createMember('PartialB');
    await createLoan(firstMember, 1_000);
    await createLoan(secondMember, 2_000);

    await dataSource.query(`
      CREATE FUNCTION "${schema}"."fail_test_opening"()
      RETURNS trigger AS $$
      BEGIN
        IF NEW."borrowerId" = '${secondMember.id}'::uuid
          AND NEW."eventType" = 'opening_balance' THEN
          RAISE EXCEPTION 'intentional isolated cutover failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await dataSource.query(`
      CREATE TRIGGER "fail_test_opening"
      BEFORE INSERT ON ${table('savings')}
      FOR EACH ROW EXECUTE FUNCTION "${schema}"."fail_test_opening"()
    `);

    const interrupted = await cutoverService.run({
      apply: true,
      at: cutoverAt,
    });

    expect(interrupted.created).toBe(1);
    expect(interrupted.failed).toBe(1);
    expect(await openingsFor(firstMember.id)).toHaveLength(1);
    expect(await openingsFor(secondMember.id)).toHaveLength(0);

    await dataSource.query(
      `DROP TRIGGER "fail_test_opening" ON ${table('savings')}`,
    );
    await dataSource.query(`DROP FUNCTION "${schema}"."fail_test_opening"()`);
    const rerun = await cutoverService.run({ apply: true, at: cutoverAt });

    expect(rerun.created).toBe(1);
    expect(rerun.alreadyCutOver).toBe(1);
    expect(rerun.failed).toBe(0);
    expect(await openingsFor(firstMember.id)).toHaveLength(1);
    expect(await openingsFor(secondMember.id)).toHaveLength(1);
  });

  it('executes the default command mode as a zero-write isolated dry-run', async () => {
    const member = await createMember('CommandDryRun');
    await createLoan(member, 600);
    const before = await savingsRepository.count();

    const result = await executeSavingsLedgerCutoverCommand(
      cutoverService,
      [],
      cutoverAt,
    );

    expect(result.mode).toBe('dry-run');
    expect(result.preflight.summary.eligibleOpenings).toBe(1);
    expect(await savingsRepository.count()).toBe(before);

    const apply = await executeSavingsLedgerCutoverCommand(
      cutoverService,
      ['--apply', `--confirm=${SAVINGS_OPENING_CONFIRMATION}`],
      cutoverAt,
    );
    expect(apply.created).toBe(1);
  });
});
