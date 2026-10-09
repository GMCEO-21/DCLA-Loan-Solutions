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
import {
  Repayment,
  RepaymentOperationType,
  RepaymentStatus,
} from '../src/repayments/repayment.entity';
import { RepaymentsService } from '../src/repayments/repayments.service';
import { Savings, SavingsEventType } from '../src/savings/savings.entity';
import { SavingsService } from '../src/savings/savings.service';
import { SavingsHistoryService } from '../src/savings/savings-history.service';
import { SavingsHistoryScope } from '../src/savings/dto/savings-history-query.dto';
import { Role } from '../src/roles/role.entity';
import { User } from '../src/users/user.entity';

jest.setTimeout(30_000);

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const concurrencyEnabled = process.env.RUN_SAVINGS_CONCURRENCY_TESTS === 'true';

if (concurrencyEnabled && !testDatabaseUrl) {
  throw new Error(
    'RUN_SAVINGS_CONCURRENCY_TESTS requires an isolated TEST_DATABASE_URL',
  );
}

const describeWithPostgres =
  concurrencyEnabled && testDatabaseUrl ? describe : describe.skip;

describeWithPostgres('Savings correctness against real PostgreSQL', () => {
  const schema = `savings_concurrency_${Date.now()}_${Math.random()
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
  let adminDataSource: DataSource;
  let dataSource: DataSource;
  let loanRepository: Repository<Loan>;
  let savingsRepository: Repository<Savings>;
  let repaymentRepository: Repository<Repayment>;
  let allocationRepository: Repository<LoanRepaymentAllocation>;
  let scheduleRepository: Repository<LoanRepaymentSchedule>;
  let collectionRepository: Repository<Collection>;
  let savingsService: SavingsService;
  let savingsHistoryService: SavingsHistoryService;
  let repaymentsService: RepaymentsService;
  let loansService: LoansService;

  const table = (name: string) => `"${schema}"."${name}"`;

  beforeAll(async () => {
    if (!/^savings_concurrency_\d+_[0-9a-f]+$/.test(schema)) {
      throw new Error('Unsafe concurrency-test schema name');
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

    loanRepository = dataSource.getRepository(Loan);
    savingsRepository = dataSource.getRepository(Savings);
    repaymentRepository = dataSource.getRepository(Repayment);
    allocationRepository = dataSource.getRepository(LoanRepaymentAllocation);
    scheduleRepository = dataSource.getRepository(LoanRepaymentSchedule);
    collectionRepository = dataSource.getRepository(Collection);

    loansService = new LoansService(
      loanRepository,
      dataSource.getRepository(Member),
      collectionRepository,
      savingsRepository,
      scheduleRepository,
      dataSource.getRepository(LoanWaiver),
    );
    savingsService = new SavingsService(
      savingsRepository,
      dataSource.getRepository(Member),
      loanRepository,
      loansService,
    );
    savingsHistoryService = new SavingsHistoryService(
      savingsRepository,
      dataSource.getRepository(Member),
    );
    repaymentsService = new RepaymentsService(
      repaymentRepository,
      loanRepository,
      dataSource.getRepository(Member),
      dataSource.getRepository(Center),
      collectionRepository,
      scheduleRepository,
      allocationRepository,
      savingsRepository,
      dataSource.getRepository(CollectionBatch),
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
      `TRUNCATE TABLE ${table('center')} RESTART IDENTITY CASCADE`,
    );
  });

  afterEach(async () => {
    const violations: unknown = await dataSource.query(`
      SELECT "id"
      FROM ${table('savings')}
      WHERE "balanceBefore" IS NOT NULL
        AND "balanceAfter" IS NOT NULL
        AND "balanceAfter" <> "balanceBefore" + "amount"
    `);

    expect(violations).toEqual([]);
  });

  async function createFixture(initialSavings = 5000) {
    const role = await dataSource.getRepository(Role).save(
      dataSource.getRepository(Role).create({
        name: `manager-${Math.random()}`,
      }),
    );
    const actor = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        email: `manager-${Math.random()}@example.test`,
        password: 'not-used',
        firstName: 'Ledger',
        middleName: null,
        lastName: 'Actor',
        role,
        isActive: true,
        mustChangePassword: false,
        hashedRefreshToken: null,
      }),
    );
    const center = await dataSource.getRepository(Center).save(
      dataSource.getRepository(Center).create({
        name: `Center ${Math.random()}`,
        collectionDay: 'Wednesday',
        address: 'Test address',
        leader: 'Test leader',
      }),
    );
    const member = await dataSource.getRepository(Member).save(
      dataSource.getRepository(Member).create({
        firstName: 'Savings',
        middleName: 'Concurrency',
        lastName: 'Test',
        contactNumber: '09171234567',
        address: 'Test address',
        birthDate: new Date('1990-01-01T00:00:00.000Z'),
        center,
        centerId: center.id,
      }),
    );
    const loan = await loanRepository.save(
      loanRepository.create({
        borrower: member,
        principalAmount: 12000,
        termWeeks: 4,
        interestRate: 0,
        status: 'active',
        weeklyPaymentAmount: 3000,
        amountPaid: 0,
        balance: 12000,
        advancePaymentBuffer: 0,
        totalAmount: 12000,
        serviceCharge: 0,
        notarialFee: 0,
        savings: initialSavings,
        existingSavings: 0,
        weeksPaid: 0,
        paymentCountDisplayOffset: 1,
        netCashReleased: 12000,
        pastDueInterestAccrued: 0,
        pastDueInterestWaived: 0,
        penaltyAccrued: 0,
        penaltyWaived: 0,
        loanCreatedDate: new Date('2026-08-01T00:00:00.000Z'),
      }),
    );
    return { actor, center, member, loan };
  }

  async function createPendingPayment(
    fixture: Awaited<ReturnType<typeof createFixture>>,
  ) {
    return repaymentRepository.save(
      repaymentRepository.create({
        loan: fixture.loan,
        member: fixture.member,
        center: fixture.center,
        amount: 0,
        notes: 'Savings repayment',
        collectionDate: '2026-09-02',
        paymentDate: '2026-09-02',
        useSavings: true,
        status: RepaymentStatus.PENDING,
        operationType: RepaymentOperationType.PAYMENT,
        relatedRepaymentId: null,
        batch: null,
        batchId: null,
        createdById: null,
        approvedById: null,
        approvedAt: null,
        rejectedById: null,
        rejectedAt: null,
        rejectedReason: null,
      }),
    );
  }

  async function createPendingReversal(
    original: Repayment,
    fixture: Awaited<ReturnType<typeof createFixture>>,
  ) {
    return repaymentRepository.save(
      repaymentRepository.create({
        loan: fixture.loan,
        member: fixture.member,
        center: fixture.center,
        amount: Number(original.amount),
        notes: 'Concurrent reversal',
        collectionDate: '2026-09-02',
        paymentDate: null,
        useSavings: false,
        status: RepaymentStatus.PENDING,
        operationType: RepaymentOperationType.REVERSAL,
        relatedRepaymentId: original.id,
        batch: null,
        batchId: null,
        createdById: null,
        approvedById: null,
        approvedAt: null,
        rejectedById: null,
        rejectedAt: null,
        rejectedReason: null,
      }),
    );
  }

  async function persistedSavings(loanId: string) {
    const loan = await loanRepository.findOneByOrFail({ id: loanId });
    const entries = await savingsRepository.find({
      where: { loan: { id: loanId } },
      order: { createdAt: 'ASC' },
    });
    return { loan, entries };
  }

  it('A. serializes two withdrawals', async () => {
    const fixture = await createFixture();
    const results = await Promise.allSettled([
      savingsService.withdraw(
        {
          memberId: fixture.member.id,
          loanId: fixture.loan.id,
          amount: 4000,
        },
        fixture.actor.id,
      ),
      savingsService.withdraw(
        {
          memberId: fixture.member.id,
          loanId: fixture.loan.id,
          amount: 4000,
        },
        fixture.actor.id,
      ),
    ]);
    const persisted = await persistedSavings(fixture.loan.id);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(Number(persisted.loan.savings)).toBe(1000);
    expect(persisted.entries.map((entry) => Number(entry.amount))).toEqual([
      -4000,
    ]);
    expect(persisted.entries[0]).toMatchObject({
      eventType: SavingsEventType.MANUAL_WITHDRAWAL,
      balanceBefore: '5000.00',
      balanceAfter: '1000.00',
      performedById: fixture.actor.id,
      idempotencyKey: null,
    });
    expect(persisted.entries[0].businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('B. preserves two concurrent deposits', async () => {
    const fixture = await createFixture();
    await Promise.all([
      savingsService.deposit(
        {
          memberId: fixture.member.id,
          loanId: fixture.loan.id,
          amount: 1000,
        },
        fixture.actor.id,
      ),
      savingsService.deposit(
        {
          memberId: fixture.member.id,
          loanId: fixture.loan.id,
          amount: 2000,
        },
        fixture.actor.id,
      ),
    ]);
    const persisted = await persistedSavings(fixture.loan.id);

    expect(Number(persisted.loan.savings)).toBe(8000);
    expect(
      persisted.entries.map((entry) => Number(entry.amount)).sort(),
    ).toEqual([1000, 2000]);
    expect(
      persisted.entries.every(
        (entry) =>
          entry.eventType === SavingsEventType.MANUAL_DEPOSIT &&
          entry.performedById === fixture.actor.id &&
          entry.idempotencyKey === null &&
          Number(entry.balanceAfter) ===
            Number(entry.balanceBefore) + Number(entry.amount),
      ),
    ).toBe(true);
  });

  it('C. preserves a concurrent deposit and withdrawal', async () => {
    const fixture = await createFixture();
    await Promise.all([
      savingsService.deposit(
        {
          memberId: fixture.member.id,
          loanId: fixture.loan.id,
          amount: 1000,
        },
        fixture.actor.id,
      ),
      savingsService.withdraw(
        {
          memberId: fixture.member.id,
          loanId: fixture.loan.id,
          amount: 2000,
        },
        fixture.actor.id,
      ),
    ]);
    const persisted = await persistedSavings(fixture.loan.id);

    expect(Number(persisted.loan.savings)).toBe(4000);
    expect(
      persisted.entries.map((entry) => Number(entry.amount)).sort(),
    ).toEqual([-2000, 1000]);
    expect(
      persisted.entries.every(
        (entry) =>
          Boolean(entry.eventType) &&
          Boolean(entry.businessDate) &&
          entry.performedById === fixture.actor.id &&
          Number(entry.balanceAfter) ===
            Number(entry.balanceBefore) + Number(entry.amount),
      ),
    ).toBe(true);
  });

  it('D. serializes repayment savings usage with withdrawal', async () => {
    const fixture = await createFixture();
    const repayment = await createPendingPayment(fixture);
    const results = await Promise.allSettled([
      repaymentsService.approveRepayment(repayment.id, fixture.actor.id),
      savingsService.withdraw(
        {
          memberId: fixture.member.id,
          loanId: fixture.loan.id,
          amount: 4000,
        },
        fixture.actor.id,
      ),
    ]);
    const persisted = await persistedSavings(fixture.loan.id);
    const approved = await repaymentRepository.findOneByOrFail({
      id: repayment.id,
    });
    const signedEntryTotal = persisted.entries.reduce(
      (sum, entry) => sum + Number(entry.amount),
      0,
    );
    const allocations = await allocationRepository.find({
      where: { repaymentId: repayment.id },
    });
    const allocatedSavings = allocations.reduce(
      (sum, allocation) => sum + Number(allocation.savingsPortion),
      0,
    );
    const withdrawalSucceeded = results[1].status === 'fulfilled';
    const repaymentDebit = persisted.entries.find(
      (entry) => entry.eventType === SavingsEventType.REPAYMENT_DEBIT,
    );

    expect(results[0].status).toBe('fulfilled');
    expect(approved.status).toBe(RepaymentStatus.APPROVED);
    expect(Number(persisted.loan.savings)).toBeGreaterThanOrEqual(0);
    expect(Number(persisted.loan.savings)).toBe(5000 + signedEntryTotal);
    expect(persisted.entries.every((entry) => Number(entry.amount) < 0)).toBe(
      true,
    );
    expect(allocatedSavings).toBe(Number(persisted.loan.amountPaid));
    expect(repaymentDebit).toMatchObject({
      referenceType: 'repayment',
      referenceId: repayment.id,
      idempotencyKey: `repayment:v1:${repayment.id}:savings-debit`,
      performedById: fixture.actor.id,
      reversalOfId: null,
    });
    expect(Number(repaymentDebit?.amount)).toBe(-allocatedSavings);
    expect(Number(repaymentDebit?.balanceAfter)).toBe(
      Number(repaymentDebit?.balanceBefore) + Number(repaymentDebit?.amount),
    );
    if (withdrawalSucceeded) {
      expect(Number(persisted.loan.savings)).toBe(0);
      expect(Number(persisted.loan.amountPaid)).toBe(1000);
      expect(persisted.entries).toHaveLength(2);
    } else {
      expect(Number(persisted.loan.savings)).toBe(2000);
      expect(Number(persisted.loan.amountPaid)).toBe(3000);
      expect(persisted.entries).toHaveLength(1);
    }
  });

  it('E. restores repayment savings exactly once under double reversal', async () => {
    const fixture = await createFixture();
    const payment = await createPendingPayment(fixture);
    await repaymentsService.approveRepayment(payment.id, fixture.actor.id);
    const reversalA = await createPendingReversal(payment, fixture);
    const reversalB = await createPendingReversal(payment, fixture);

    const results = await Promise.allSettled([
      repaymentsService.approveRepayment(reversalA.id, fixture.actor.id),
      repaymentsService.approveRepayment(reversalB.id, fixture.actor.id),
    ]);
    const persisted = await persistedSavings(fixture.loan.id);
    const reversals = await repaymentRepository.find({
      where: {
        relatedRepaymentId: payment.id,
        operationType: RepaymentOperationType.REVERSAL,
      },
    });
    const collection = await collectionRepository.findOneByOrFail({
      memberId: fixture.member.id,
      centerId: fixture.center.id,
      collectionDate: '2026-09-02',
    });
    const repaymentDebit = persisted.entries.find(
      (entry) => entry.eventType === SavingsEventType.REPAYMENT_DEBIT,
    );
    const reversalCredit = persisted.entries.find(
      (entry) => entry.eventType === SavingsEventType.REPAYMENT_REVERSAL_CREDIT,
    );
    const approvedReversal = reversals.find(
      (entry) => entry.status === RepaymentStatus.APPROVED,
    );

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(Number(persisted.loan.savings)).toBe(5000);
    expect(Number(persisted.loan.amountPaid)).toBe(0);
    expect(Number(persisted.loan.balance)).toBe(12000);
    expect(
      persisted.entries.filter((entry) => Number(entry.amount) > 0),
    ).toHaveLength(1);
    expect(
      Number(
        persisted.entries.filter((entry) => Number(entry.amount) > 0)[0].amount,
      ),
    ).toBe(3000);
    expect(
      reversals.filter((entry) => entry.status === RepaymentStatus.APPROVED),
    ).toHaveLength(1);
    expect(
      await allocationRepository.countBy({ repaymentId: payment.id }),
    ).toBe(0);
    expect(Number(collection.paymentReceived)).toBe(0);
    expect(repaymentDebit).toBeDefined();
    expect(reversalCredit).toMatchObject({
      amount: '3000.00',
      balanceBefore: '2000.00',
      balanceAfter: '5000.00',
      referenceType: 'repayment_reversal',
      referenceId: approvedReversal?.id,
      idempotencyKey: `repayment:v1:${approvedReversal?.id}:savings-reversal-credit`,
      performedById: fixture.actor.id,
      reversalOfId: repaymentDebit?.id,
    });
  });

  it('F. records only positive normal-loan contributions across carry-forward', async () => {
    const fixture = await createFixture();
    const member = await dataSource.getRepository(Member).save(
      dataSource.getRepository(Member).create({
        firstName: 'Normal',
        middleName: 'Loan',
        lastName: 'Ledger',
        contactNumber: '09171234568',
        address: 'Test address',
        birthDate: new Date('1991-01-01T00:00:00.000Z'),
        center: fixture.center,
        centerId: fixture.center.id,
      }),
    );

    const first = await loansService.create(
      {
        borrowerId: member.id,
        principalAmount: 10_000,
        termWeeks: 8,
        savings: 500,
      },
      fixture.actor.id,
    );
    first.status = 'paid';
    first.createdAt = new Date('2026-09-01T00:00:00.000Z');
    await loanRepository.save(first);
    const second = await loansService.create(
      {
        borrowerId: member.id,
        principalAmount: 12_000,
        termWeeks: 8,
        savings: 300,
      },
      fixture.actor.id,
    );
    second.status = 'paid';
    second.createdAt = new Date('2026-09-02T00:00:00.000Z');
    await loanRepository.save(second);
    const third = await loansService.create(
      {
        borrowerId: member.id,
        principalAmount: 14_000,
        termWeeks: 8,
        savings: 0,
      },
      fixture.actor.id,
    );
    const entries = await savingsRepository.find({
      where: { borrower: { id: member.id } },
      order: { createdAt: 'ASC' },
    });

    expect(Number(first.savings)).toBe(500);
    expect(Number(second.savings)).toBe(800);
    expect(Number(third.savings)).toBe(800);
    expect(entries).toHaveLength(2);
    expect(
      entries.map((entry) => [
        entry.eventType,
        Number(entry.amount),
        Number(entry.balanceBefore),
        Number(entry.balanceAfter),
      ]),
    ).toEqual([
      [SavingsEventType.LOAN_ORIGINATION_CONTRIBUTION, 500, 0, 500],
      [SavingsEventType.LOAN_ORIGINATION_CONTRIBUTION, 300, 500, 800],
    ]);
    expect(
      entries.every((entry) => entry.performedById === fixture.actor.id),
    ).toBe(true);
  });

  it('G. records each repeated reloan contribution once and excludes carry-forward', async () => {
    const fixture = await createFixture(2000);
    fixture.loan.termWeeks = 12;
    fixture.loan.weeksPaid = 8;
    fixture.loan.balance = 4000;
    await loanRepository.save(fixture.loan);

    const first = await loansService.reloan(
      fixture.loan.id,
      {
        newPrincipalAmount: 12_000,
        newTermWeeks: 12,
        mode: 'netoff',
        serviceCharge: 100,
        notarialFee: 50,
        savings: 300,
      },
      fixture.actor.id,
    );
    first.newLoan.weeksPaid = 8;
    await loanRepository.save(first.newLoan);
    const second = await loansService.reloan(
      first.newLoan.id,
      {
        newPrincipalAmount: 14_000,
        newTermWeeks: 12,
        mode: 'netoff',
        serviceCharge: 100,
        notarialFee: 50,
        savings: 200,
      },
      fixture.actor.id,
    );
    second.newLoan.weeksPaid = 8;
    await loanRepository.save(second.newLoan);
    const third = await loansService.reloan(
      second.newLoan.id,
      {
        newPrincipalAmount: 16_000,
        newTermWeeks: 12,
        mode: 'payoff',
        serviceCharge: 100,
        notarialFee: 50,
        savings: 0,
      },
      fixture.actor.id,
    );
    const entries = await savingsRepository.find({
      where: { borrower: { id: fixture.member.id } },
      order: { createdAt: 'ASC' },
    });

    expect(Number(first.newLoan.savings)).toBe(2300);
    expect(Number(second.newLoan.savings)).toBe(2500);
    expect(Number(third.newLoan.savings)).toBe(2500);
    expect(
      entries.map((entry) => [entry.eventType, Number(entry.amount)]),
    ).toEqual([
      [SavingsEventType.RELOAN_CONTRIBUTION, 300],
      [SavingsEventType.RELOAN_CONTRIBUTION, 200],
    ]);
    expect(
      entries.every(
        (entry) =>
          Number(entry.balanceAfter) ===
          Number(entry.balanceBefore) + Number(entry.amount),
      ),
    ).toBe(true);
  });

  it('H. prevents a repayment approval retry from duplicating its savings debit', async () => {
    const fixture = await createFixture();
    const repayment = await createPendingPayment(fixture);

    await repaymentsService.approveRepayment(repayment.id, fixture.actor.id);
    await expect(
      repaymentsService.approveRepayment(repayment.id, fixture.actor.id),
    ).rejects.toThrow('Only pending repayments can be approved');

    expect(
      await savingsRepository.countBy({
        idempotencyKey: `repayment:v1:${repayment.id}:savings-debit`,
      }),
    ).toBe(1);
  });

  it('I. reads paginated ledger history with deterministic ordering and actor provenance', async () => {
    const fixture = await createFixture();
    const sharedCreatedAt = new Date('2026-09-03T04:05:06.000Z');
    const debitId = '00000000-0000-4000-8000-000000000001';
    const reversalId = '00000000-0000-4000-8000-000000000002';

    await savingsRepository.save([
      savingsRepository.create({
        id: debitId,
        borrower: fixture.member,
        loan: fixture.loan,
        amount: -125.5,
        remarks: 'Repayment debit',
        eventType: SavingsEventType.REPAYMENT_DEBIT,
        balanceBefore: 1000,
        balanceAfter: 874.5,
        businessDate: '2026-09-02',
        referenceType: 'repayment',
        referenceId: null,
        idempotencyKey: 'history-reader-debit',
        performedById: fixture.actor.id,
        reversalOfId: null,
        createdAt: sharedCreatedAt,
        updatedAt: sharedCreatedAt,
      }),
      savingsRepository.create({
        id: reversalId,
        borrower: fixture.member,
        loan: fixture.loan,
        amount: 125.5,
        remarks: 'Repayment reversal',
        eventType: SavingsEventType.REPAYMENT_REVERSAL_CREDIT,
        balanceBefore: 874.5,
        balanceAfter: 1000,
        businessDate: '2026-09-03',
        referenceType: 'repayment_reversal',
        referenceId: null,
        idempotencyKey: 'history-reader-reversal',
        performedById: null,
        reversalOfId: debitId,
        createdAt: sharedCreatedAt,
        updatedAt: sharedCreatedAt,
      }),
      savingsRepository.create({
        borrower: fixture.member,
        loan: fixture.loan,
        amount: 50,
        remarks: 'Legacy row',
        eventType: null,
        balanceBefore: null,
        balanceAfter: null,
        businessDate: null,
        referenceType: null,
        referenceId: null,
        idempotencyKey: null,
        performedById: null,
        reversalOfId: null,
        createdAt: sharedCreatedAt,
        updatedAt: sharedCreatedAt,
      }),
    ]);

    const firstPage = await savingsHistoryService.findMemberHistory(
      fixture.member.id,
      { scope: SavingsHistoryScope.LEDGER, page: 1, limit: 1 },
    );
    const secondPage = await savingsHistoryService.findMemberHistory(
      fixture.member.id,
      { scope: SavingsHistoryScope.LEDGER, page: 2, limit: 1 },
    );

    expect(firstPage).toEqual({
      scope: SavingsHistoryScope.LEDGER,
      items: [
        expect.objectContaining({
          recordClass: SavingsHistoryScope.LEDGER,
          id: reversalId,
          eventType: SavingsEventType.REPAYMENT_REVERSAL_CREDIT,
          amount: '125.50',
          balanceBefore: '874.50',
          balanceAfter: '1000.00',
          businessDate: '2026-09-03',
          performedBy: null,
          referenceType: 'repayment_reversal',
          reversalOfId: debitId,
        }),
      ],
      pagination: { page: 1, limit: 1, total: 2, totalPages: 2 },
    });
    expect(secondPage.items).toEqual([
      expect.objectContaining({
        id: debitId,
        amount: '-125.50',
        performedBy: {
          id: fixture.actor.id,
          name: 'Ledger Actor',
        },
      }),
    ]);
  });

  it('J. reads legacy history without fabricating ledger metadata', async () => {
    const fixture = await createFixture();
    const sharedCreatedAt = new Date('2026-09-03T04:05:06.000Z');
    await savingsRepository.save([
      savingsRepository.create({
        id: '00000000-0000-4000-8000-000000000011',
        borrower: fixture.member,
        loan: fixture.loan,
        amount: 250,
        remarks: 'Legacy credit',
        eventType: null,
        balanceBefore: null,
        balanceAfter: null,
        businessDate: null,
        referenceType: null,
        referenceId: null,
        idempotencyKey: null,
        performedById: null,
        reversalOfId: null,
        createdAt: sharedCreatedAt,
        updatedAt: sharedCreatedAt,
      }),
      savingsRepository.create({
        id: '00000000-0000-4000-8000-000000000012',
        borrower: fixture.member,
        loan: fixture.loan,
        amount: -300,
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
        createdAt: sharedCreatedAt,
        updatedAt: sharedCreatedAt,
      }),
      savingsRepository.create({
        borrower: fixture.member,
        loan: fixture.loan,
        amount: 100,
        remarks: 'Ledger row',
        eventType: SavingsEventType.MANUAL_DEPOSIT,
        balanceBefore: 0,
        balanceAfter: 100,
        businessDate: '2026-09-03',
        referenceType: null,
        referenceId: null,
        idempotencyKey: null,
        performedById: null,
        reversalOfId: null,
        createdAt: sharedCreatedAt,
        updatedAt: sharedCreatedAt,
      }),
    ]);

    const result = await savingsHistoryService.findMemberHistory(
      fixture.member.id,
      { scope: SavingsHistoryScope.LEGACY, page: 1, limit: 25 },
    );

    expect(result).toEqual({
      scope: SavingsHistoryScope.LEGACY,
      items: [
        {
          recordClass: SavingsHistoryScope.LEGACY,
          id: '00000000-0000-4000-8000-000000000012',
          amount: '-300.00',
          direction: 'debit',
          createdAt: sharedCreatedAt,
          remarks: 'Legacy debit',
        },
        {
          recordClass: SavingsHistoryScope.LEGACY,
          id: '00000000-0000-4000-8000-000000000011',
          amount: '250.00',
          direction: 'credit',
          createdAt: sharedCreatedAt,
          remarks: 'Legacy credit',
        },
      ],
      pagination: { page: 1, limit: 25, total: 2, totalPages: 1 },
    });
    for (const item of result.items) {
      expect(item).not.toHaveProperty('eventType');
      expect(item).not.toHaveProperty('balanceBefore');
      expect(item).not.toHaveProperty('balanceAfter');
      expect(item).not.toHaveProperty('businessDate');
      expect(item).not.toHaveProperty('performedBy');
      expect(item).not.toHaveProperty('referenceType');
      expect(item).not.toHaveProperty('referenceId');
      expect(item).not.toHaveProperty('reversalOfId');
    }
  });

  async function installLoanSavingsFailureTrigger() {
    await dataSource.query(`
      CREATE OR REPLACE FUNCTION "${schema}"."fail_savings_balance_update"()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'forced loan savings update failure';
      END;
      $$ LANGUAGE plpgsql
    `);
    await dataSource.query(`
      CREATE TRIGGER "fail_savings_balance_update"
      BEFORE UPDATE OF "savings" ON ${table('loan')}
      FOR EACH ROW EXECUTE FUNCTION "${schema}"."fail_savings_balance_update"()
    `);
  }

  async function dropLoanSavingsFailureTrigger() {
    await dataSource.query(
      `DROP TRIGGER IF EXISTS "fail_savings_balance_update" ON ${table('loan')}`,
    );
    await dataSource.query(
      `DROP FUNCTION IF EXISTS "${schema}"."fail_savings_balance_update"()`,
    );
  }

  it.each(['deposit', 'withdraw'] as const)(
    'rolls back a manual %s after history insertion',
    async (operation) => {
      const fixture = await createFixture();
      await installLoanSavingsFailureTrigger();
      try {
        await expect(
          savingsService[operation](
            {
              memberId: fixture.member.id,
              loanId: fixture.loan.id,
              amount: 1000,
            },
            fixture.actor.id,
          ),
        ).rejects.toThrow('forced loan savings update failure');
      } finally {
        await dropLoanSavingsFailureTrigger();
      }
      const persisted = await persistedSavings(fixture.loan.id);
      expect(Number(persisted.loan.savings)).toBe(5000);
      expect(persisted.entries).toHaveLength(0);
    },
  );

  it('rolls back repayment posting after the savings debit', async () => {
    const fixture = await createFixture();
    const repayment = await createPendingPayment(fixture);
    await dataSource.query(`
      CREATE OR REPLACE FUNCTION "${schema}"."fail_collection_write"()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'forced collection write failure';
      END;
      $$ LANGUAGE plpgsql
    `);
    await dataSource.query(`
      CREATE TRIGGER "fail_collection_write"
      BEFORE INSERT OR UPDATE ON ${table('collection')}
      FOR EACH ROW EXECUTE FUNCTION "${schema}"."fail_collection_write"()
    `);
    try {
      await expect(
        repaymentsService.approveRepayment(repayment.id, fixture.actor.id),
      ).rejects.toThrow('forced collection write failure');
    } finally {
      await dataSource.query(
        `DROP TRIGGER IF EXISTS "fail_collection_write" ON ${table('collection')}`,
      );
      await dataSource.query(
        `DROP FUNCTION IF EXISTS "${schema}"."fail_collection_write"()`,
      );
    }

    const persisted = await persistedSavings(fixture.loan.id);
    const storedRepayment = await repaymentRepository.findOneByOrFail({
      id: repayment.id,
    });
    expect(Number(persisted.loan.savings)).toBe(5000);
    expect(Number(persisted.loan.amountPaid)).toBe(0);
    expect(persisted.entries).toHaveLength(0);
    expect(storedRepayment.status).toBe(RepaymentStatus.PENDING);
    expect(await allocationRepository.count()).toBe(0);
    expect(await scheduleRepository.count()).toBe(0);
    expect(await collectionRepository.count()).toBe(0);
  });

  it('rolls back reversal posting after the savings restoration', async () => {
    const fixture = await createFixture();
    const payment = await createPendingPayment(fixture);
    await repaymentsService.approveRepayment(payment.id, fixture.actor.id);
    const reversal = await createPendingReversal(payment, fixture);
    await dataSource.query(`
      CREATE OR REPLACE FUNCTION "${schema}"."fail_collection_update"()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'forced collection update failure';
      END;
      $$ LANGUAGE plpgsql
    `);
    await dataSource.query(`
      CREATE TRIGGER "fail_collection_update"
      BEFORE UPDATE ON ${table('collection')}
      FOR EACH ROW EXECUTE FUNCTION "${schema}"."fail_collection_update"()
    `);
    try {
      await expect(
        repaymentsService.approveRepayment(reversal.id, fixture.actor.id),
      ).rejects.toThrow('forced collection update failure');
    } finally {
      await dataSource.query(
        `DROP TRIGGER IF EXISTS "fail_collection_update" ON ${table('collection')}`,
      );
      await dataSource.query(
        `DROP FUNCTION IF EXISTS "${schema}"."fail_collection_update"()`,
      );
    }

    const persisted = await persistedSavings(fixture.loan.id);
    const storedReversal = await repaymentRepository.findOneByOrFail({
      id: reversal.id,
    });
    const collection = await collectionRepository.findOneByOrFail({
      memberId: fixture.member.id,
      centerId: fixture.center.id,
      collectionDate: '2026-09-02',
    });
    expect(Number(persisted.loan.savings)).toBe(2000);
    expect(Number(persisted.loan.amountPaid)).toBe(3000);
    expect(persisted.entries).toHaveLength(1);
    expect(Number(persisted.entries[0].amount)).toBe(-3000);
    expect(storedReversal.status).toBe(RepaymentStatus.PENDING);
    expect(
      await allocationRepository.countBy({ repaymentId: payment.id }),
    ).toBe(1);
    expect(Number(collection.paymentReceived)).toBe(3000);
  });
});
