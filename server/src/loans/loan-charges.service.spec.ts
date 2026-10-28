/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { EntityManager, Repository } from 'typeorm';
import { LoanRepaymentAllocation } from '../repayments/entities/loan-repayment-allocation.entity';
import { LoanRepaymentSchedule } from '../repayments/entities/loan-repayment-schedule.entity';
import {
  Repayment,
  RepaymentOperationType,
  RepaymentStatus,
} from '../repayments/repayment.entity';
import {
  LoanChargeLedger,
  LoanChargeLedgerEventType,
  LoanChargeType,
} from './entities/loan-charge-ledger.entity';
import { LoanWaiver } from './entities/loan-waiver.entity';
import { LoanChargePolicyService } from './loan-charge-policy.service';
import { LoanChargesService } from './loan-charges.service';
import { Loan } from './loan.entity';

const eligibleLoan = (overrides: Partial<Loan> = {}) =>
  ({
    id: '10000000-0000-4000-8000-000000000001',
    status: 'active',
    weeklyPaymentAmount: 1100,
    balance: 5000,
    savings: 0,
    penaltyAccrued: 0,
    penaltyPaid: 0,
    penaltyWaived: 0,
    pastDueInterestAccrued: 0,
    pastDueInterestPaid: 0,
    pastDueInterestWaived: 0,
    overdueChargePolicyVersion: 'DCLA_2026_V1',
    overdueChargePolicyEffectiveDate: '2026-10-01',
    ...overrides,
  }) as Loan;

function createServiceHarness(options?: {
  loan?: Loan;
  schedules?: LoanRepaymentSchedule[];
  pending?: boolean;
  ledgerEntries?: LoanChargeLedger[];
}) {
  const loan = options?.loan ?? eligibleLoan();
  const ledgerEntries = options?.ledgerEntries ?? [];
  const queryBuilder: any = {
    setLock: jest.fn(() => queryBuilder),
    where: jest.fn(() => queryBuilder),
    getOne: jest.fn().mockResolvedValue(loan),
  };
  const loanRepository = {
    manager: { transaction: jest.fn() },
    createQueryBuilder: jest.fn(() => queryBuilder),
    findOne: jest.fn().mockResolvedValue(loan),
    save: jest.fn(async (value: Loan) => value),
  };
  const ledgerRepository = {
    exists: jest.fn(async ({ where }: any) =>
      ledgerEntries.some(
        (entry) => entry.idempotencyKey === where.idempotencyKey,
      ),
    ),
    create: jest.fn((value: Partial<LoanChargeLedger>) => ({
      id: `entry-${ledgerEntries.length + 1}`,
      createdAt: new Date('2026-10-15T00:00:00.000Z'),
      ...value,
    })),
    save: jest.fn(async (value: LoanChargeLedger) => {
      ledgerEntries.push(value);
      return value;
    }),
    find: jest.fn().mockImplementation(async (query?: any) => {
      const where = query?.where ?? {};
      return ledgerEntries.filter(
        (entry) =>
          (!where.loanId || entry.loanId === where.loanId) &&
          (!where.sourceRepaymentId ||
            entry.sourceRepaymentId === where.sourceRepaymentId) &&
          (!where.eventType || entry.eventType === where.eventType),
      );
    }),
  };
  const scheduleRepository = {
    find: jest.fn().mockResolvedValue(options?.schedules ?? []),
  };
  const repaymentRepository = {
    exists: jest.fn().mockResolvedValue(Boolean(options?.pending)),
  };
  const waiverRepository = { find: jest.fn().mockResolvedValue([]) };
  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === Loan) return loanRepository;
      if (entity === LoanChargeLedger) return ledgerRepository;
      if (entity === LoanRepaymentSchedule) return scheduleRepository;
      if (entity === Repayment) return repaymentRepository;
      if (entity === LoanWaiver) return waiverRepository;
      throw new Error(`Unexpected repository ${String(entity)}`);
    }),
  } as unknown as EntityManager;
  const policy = {
    isEligible: jest.fn(
      (value: Loan, asOfDate?: string) =>
        value.overdueChargePolicyVersion === 'DCLA_2026_V1' &&
        Boolean(value.overdueChargePolicyEffectiveDate) &&
        (!asOfDate || value.overdueChargePolicyEffectiveDate! <= asOfDate),
    ),
  } as unknown as LoanChargePolicyService;
  const service = new LoanChargesService(
    loanRepository as unknown as Repository<Loan>,
    ledgerRepository as unknown as Repository<LoanChargeLedger>,
    scheduleRepository as unknown as Repository<LoanRepaymentSchedule>,
    waiverRepository as unknown as Repository<LoanWaiver>,
    policy,
  );
  return { service, loan, ledgerEntries, manager };
}

describe('LoanChargesService', () => {
  it('allocates penalty, PDI, then contractual balance', () => {
    const { service, loan } = createServiceHarness({
      loan: eligibleLoan({
        penaltyAccrued: 150,
        pastDueInterestAccrued: 20,
      }),
    });

    expect(service.previewPaymentAllocation(loan, 200, false)).toMatchObject({
      penalty: { amount: 150, cashPortion: 150, savingsPortion: 0 },
      pastDueInterest: { amount: 20, cashPortion: 20, savingsPortion: 0 },
      contractual: { amount: 30, cashPortion: 30, savingsPortion: 0 },
      totalApplied: 200,
      savingsUsed: 0,
      unapplied: 0,
    });
  });

  it('uses savings across charges and contractual payment when requested', () => {
    const { service, loan } = createServiceHarness({
      loan: eligibleLoan({
        savings: 500,
        penaltyAccrued: 150,
        pastDueInterestAccrued: 20,
      }),
    });

    expect(service.previewPaymentAllocation(loan, 0, true)).toMatchObject({
      penalty: { amount: 150, savingsPortion: 150 },
      pastDueInterest: { amount: 20, savingsPortion: 20 },
      contractual: { amount: 330, savingsPortion: 330 },
      savingsUsed: 500,
      totalApplied: 500,
    });
  });

  it('posts one full weekly penalty for a partially paid installment', async () => {
    const repayment = {
      status: RepaymentStatus.APPROVED,
      operationType: RepaymentOperationType.PAYMENT,
      paymentDate: '2026-10-09',
    } as Repayment;
    const schedules = [
      {
        id: 'schedule-1',
        loanId: eligibleLoan().id,
        dueDate: '2026-10-04',
        weekNumber: 1,
        amountDue: 1100,
        principalDue: 1000,
        interestDue: 100,
        allocations: [
          {
            amountApplied: 500,
            principalPortion: 400,
            repayment,
          } as LoanRepaymentAllocation,
        ],
      },
      {
        id: 'schedule-2',
        loanId: eligibleLoan().id,
        dueDate: '2026-10-11',
        weekNumber: 2,
        amountDue: 1100,
        principalDue: 1000,
        interestDue: 100,
        allocations: [],
      },
    ] as unknown as LoanRepaymentSchedule[];
    const { service, loan, ledgerEntries, manager } = createServiceHarness({
      schedules,
    });

    await service.postDueChargesForLoan(loan.id, '2026-10-10', manager);
    await service.postDueChargesForLoan(loan.id, '2026-10-10', manager);

    expect(loan.penaltyAccrued).toBe(100);
    expect(ledgerEntries).toHaveLength(1);
    expect(ledgerEntries[0]).toMatchObject({
      chargeType: LoanChargeType.WEEKLY_PENALTY,
      eventType: LoanChargeLedgerEventType.ACCRUAL,
      amount: '100.00',
    });
  });

  it('does not post a weekly penalty before the Saturday assessment date', async () => {
    const schedules = [
      {
        id: 'schedule-1',
        loanId: eligibleLoan().id,
        dueDate: '2026-10-04',
        weekNumber: 1,
        amountDue: 1100,
        principalDue: 1000,
        interestDue: 100,
        allocations: [],
      },
      {
        id: 'schedule-2',
        loanId: eligibleLoan().id,
        dueDate: '2026-10-11',
        weekNumber: 2,
        amountDue: 1100,
        principalDue: 1000,
        interestDue: 100,
        allocations: [],
      },
    ] as unknown as LoanRepaymentSchedule[];
    const { service, loan, ledgerEntries, manager } = createServiceHarness({
      schedules,
    });

    await service.postDueChargesForLoan(loan.id, '2026-10-09', manager);

    expect(loan.penaltyAccrued).toBe(0);
    expect(ledgerEntries).toHaveLength(0);
  });

  it('does not penalize an installment fully collected by Friday', async () => {
    const repayment = {
      status: RepaymentStatus.APPROVED,
      operationType: RepaymentOperationType.PAYMENT,
      paymentDate: '2026-10-09',
    } as Repayment;
    const schedules = [
      {
        id: 'schedule-1',
        loanId: eligibleLoan().id,
        dueDate: '2026-10-04',
        weekNumber: 1,
        amountDue: 1100,
        principalDue: 1000,
        interestDue: 100,
        allocations: [
          {
            amountApplied: 1100,
            principalPortion: 1000,
            repayment,
          } as LoanRepaymentAllocation,
        ],
      },
      {
        id: 'schedule-2',
        loanId: eligibleLoan().id,
        dueDate: '2026-10-11',
        weekNumber: 2,
        amountDue: 1100,
        principalDue: 1000,
        interestDue: 100,
        allocations: [],
      },
    ] as LoanRepaymentSchedule[];
    const { service, loan, ledgerEntries, manager } = createServiceHarness({
      schedules,
    });

    await service.postDueChargesForLoan(loan.id, '2026-10-10', manager);

    expect(loan.penaltyAccrued).toBe(0);
    expect(ledgerEntries).toHaveLength(0);
  });

  it('defers charging while an on-time repayment is pending approval', async () => {
    const schedules = [
      {
        id: 'schedule-1',
        loanId: eligibleLoan().id,
        dueDate: '2026-10-04',
        weekNumber: 1,
        amountDue: 1100,
        principalDue: 1000,
        interestDue: 100,
        allocations: [],
      },
      {
        id: 'schedule-2',
        loanId: eligibleLoan().id,
        dueDate: '2026-10-11',
        weekNumber: 2,
        amountDue: 1100,
        principalDue: 1000,
        interestDue: 100,
        allocations: [],
      },
    ] as unknown as LoanRepaymentSchedule[];
    const { service, loan, ledgerEntries, manager } = createServiceHarness({
      schedules,
      pending: true,
    });

    const result = await service.postDueChargesForLoan(
      loan.id,
      '2026-10-10',
      manager,
    );

    expect(result.skippedPendingCount).toBe(1);
    expect(loan.penaltyAccrued).toBe(0);
    expect(ledgerEntries).toHaveLength(0);
  });

  it('never posts charges for a legacy loan', async () => {
    const { service, loan, ledgerEntries, manager } = createServiceHarness({
      loan: eligibleLoan({
        overdueChargePolicyVersion: null,
        overdueChargePolicyEffectiveDate: null,
      }),
    });

    const result = await service.postDueChargesForLoan(
      loan.id,
      '2026-12-31',
      manager,
    );

    expect(result).toEqual({ chargeCount: 0, skippedPendingCount: 0 });
    expect(ledgerEntries).toHaveLength(0);
  });

  it('uses remaining scheduled principal for maturity penalty and daily PDI', async () => {
    const repayment = {
      status: RepaymentStatus.APPROVED,
      operationType: RepaymentOperationType.PAYMENT,
      paymentDate: '2026-10-05',
    } as Repayment;
    const schedules = [
      {
        id: 'schedule-1',
        loanId: eligibleLoan().id,
        dueDate: '2026-10-04',
        weekNumber: 1,
        amountDue: 550,
        principalDue: 500,
        interestDue: 50,
        allocations: [
          {
            amountApplied: 550,
            principalPortion: 500,
            repayment,
          } as LoanRepaymentAllocation,
        ],
      },
      {
        id: 'schedule-2',
        loanId: eligibleLoan().id,
        dueDate: '2026-10-11',
        weekNumber: 2,
        amountDue: 550,
        principalDue: 500,
        interestDue: 50,
        allocations: [],
      },
    ] as LoanRepaymentSchedule[];
    const { service, loan, ledgerEntries, manager } = createServiceHarness({
      loan: eligibleLoan({ weeklyPaymentAmount: 550 }),
      schedules,
    });

    await service.postDueChargesForLoan(loan.id, '2026-10-13', manager);

    const maturity = ledgerEntries.find(
      (entry) => entry.chargeType === LoanChargeType.MATURITY_PENALTY,
    );
    const interest = ledgerEntries.filter(
      (entry) => entry.chargeType === LoanChargeType.PAST_DUE_INTEREST,
    );
    expect(maturity).toMatchObject({ amount: '150.00', baseAmount: '500.00' });
    expect(interest).toHaveLength(2);
    expect(interest.map((entry) => entry.amount)).toEqual(['1.67', '1.67']);
    expect(loan.pastDueInterestAccrued).toBe(3.34);
  });

  it('creates exact compensating rows for charge payment reversal', async () => {
    const loan = eligibleLoan({ penaltyPaid: 100, pastDueInterestPaid: 20 });
    const originalEntries = [
      {
        id: 'penalty-payment',
        loanId: loan.id,
        sourceRepaymentId: 'original',
        policyVersion: 'DCLA_2026_V1',
        chargeType: LoanChargeType.WEEKLY_PENALTY,
        eventType: LoanChargeLedgerEventType.PAYMENT,
        amount: '100.00',
        cashPortion: '60.00',
        savingsPortion: '40.00',
        scheduleId: null,
        periodStart: null,
        periodEnd: null,
        createdAt: new Date('2026-10-15T00:00:00.000Z'),
        idempotencyKey: 'original-penalty',
      },
      {
        id: 'interest-payment',
        loanId: loan.id,
        sourceRepaymentId: 'original',
        policyVersion: 'DCLA_2026_V1',
        chargeType: LoanChargeType.PAST_DUE_INTEREST,
        eventType: LoanChargeLedgerEventType.PAYMENT,
        amount: '20.00',
        cashPortion: '20.00',
        savingsPortion: '0.00',
        scheduleId: null,
        periodStart: null,
        periodEnd: null,
        createdAt: new Date('2026-10-15T00:00:01.000Z'),
        idempotencyKey: 'original-interest',
      },
    ] as LoanChargeLedger[];
    const { service, ledgerEntries, manager } = createServiceHarness({
      loan,
      ledgerEntries: originalEntries,
    });

    const result = await service.reversePaymentAllocation(
      loan,
      'original',
      'reversal',
      manager,
    );

    expect(result).toEqual({
      penaltyReversed: 100,
      pastDueInterestReversed: 20,
      cashReversed: 80,
      savingsReversed: 40,
      totalReversed: 120,
    });
    expect(loan.penaltyPaid).toBe(0);
    expect(loan.pastDueInterestPaid).toBe(0);
    expect(
      ledgerEntries.filter(
        (entry) =>
          entry.eventType === LoanChargeLedgerEventType.PAYMENT_REVERSAL,
      ),
    ).toHaveLength(2);
  });

  it('reconciles ledger accruals and net payments to loan summaries', async () => {
    const loan = eligibleLoan({
      penaltyAccrued: 100,
      penaltyPaid: 60,
    });
    const entries = [
      {
        id: 'accrual',
        loanId: loan.id,
        chargeType: LoanChargeType.WEEKLY_PENALTY,
        eventType: LoanChargeLedgerEventType.ACCRUAL,
        amount: '100.00',
      },
      {
        id: 'payment-one',
        loanId: loan.id,
        chargeType: LoanChargeType.WEEKLY_PENALTY,
        eventType: LoanChargeLedgerEventType.PAYMENT,
        amount: '80.00',
      },
      {
        id: 'payment-reversal',
        loanId: loan.id,
        chargeType: LoanChargeType.WEEKLY_PENALTY,
        eventType: LoanChargeLedgerEventType.PAYMENT_REVERSAL,
        amount: '20.00',
      },
    ] as LoanChargeLedger[];
    const { service } = createServiceHarness({
      loan,
      ledgerEntries: entries,
    });

    const result = await service.reconcile(loan.id);

    expect(result.reconciled).toBe(true);
    expect(result.ledger.penaltyAccrued).toBe(100);
    expect(result.ledger.penaltyPaid).toBe(60);
  });
});
