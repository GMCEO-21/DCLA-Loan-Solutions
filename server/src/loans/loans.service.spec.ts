/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { LoansService } from './loans.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Loan } from './loan.entity';
import { Member } from '../members/entities/member.entity';
import { Collection } from '../collections/entities/collection.entity';
import { Savings } from '../savings/savings.entity';
import { LoanRepaymentSchedule } from '../repayments/entities/loan-repayment-schedule.entity';
import { LoanWaiver } from './entities/loan-waiver.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { SavingsEventType } from '../savings/savings.entity';
import { LoanChargePolicyService } from './loan-charge-policy.service';
import { LoanChargesService } from './loan-charges.service';

function createLoanWriterHarness(
  seedLoans: Loan[] = [],
  enrollment: {
    version: 'DCLA_2026_V1';
    effectiveDate: string;
  } | null = null,
  policyEligible = false,
) {
  const member = { id: 'member-1' } as Member;
  const loans = seedLoans.map((loan) => ({ ...loan, borrower: member }));
  const entries: Savings[] = [];
  let nextLoanId = loans.length + 1;

  const queryBuilder: any = {
    setLock: jest.fn(() => queryBuilder),
    where: jest.fn(() => queryBuilder),
    getOne: jest.fn(async () => null),
  };
  const loanRepository = {
    manager: {
      transaction: jest.fn(<T>(work: (manager: EntityManager) => Promise<T>) =>
        work(manager),
      ),
    },
    find: jest.fn(async (options: any) => {
      const status = options?.where?.status;
      return loans
        .filter((loan) => !status || loan.status === status)
        .sort((a, b) => {
          const byDate = b.createdAt.getTime() - a.createdAt.getTime();
          return byDate || b.id.localeCompare(a.id);
        })
        .slice(0, options?.take);
    }),
    findOne: jest.fn(async (options: any) => {
      const id = options?.where?.id;
      return loans.find((loan) => loan.id === id) ?? null;
    }),
    create: jest.fn((value: Partial<Loan>) => value as Loan),
    save: jest.fn(async (loan: Loan) => {
      const existingIndex = loans.findIndex((item) => item.id === loan.id);
      if (existingIndex >= 0) {
        loans[existingIndex] = loan;
        return loan;
      }
      loan.id = `loan-${nextLoanId++}`;
      loan.createdAt ??= new Date(`2026-09-0${nextLoanId}T00:00:00.000Z`);
      loans.push(loan);
      return loan;
    }),
    update: jest.fn(async (id: string, value: Partial<Loan>) => {
      const loan = loans.find((item) => item.id === id);
      if (loan) Object.assign(loan, value);
      return { affected: loan ? 1 : 0 };
    }),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
  const savingsRepository = {
    create: jest.fn((value: Partial<Savings>) => value as Savings),
    save: jest.fn(async (entry: Savings) => {
      entry.id = `entry-${entries.length + 1}`;
      entries.push(entry);
      return entry;
    }),
  };
  const collectionRepository = { update: jest.fn().mockResolvedValue({}) };
  const scheduleRepository = {
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    create: jest.fn(
      (value: Partial<LoanRepaymentSchedule>) => value as LoanRepaymentSchedule,
    ),
    save: jest.fn(async (value: LoanRepaymentSchedule[]) => value),
  };
  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === Loan) return loanRepository;
      if (entity === Member) {
        return { findOne: jest.fn().mockResolvedValue(member) };
      }
      if (entity === Collection) return collectionRepository;
      if (entity === Savings) return savingsRepository;
      if (entity === LoanRepaymentSchedule) return scheduleRepository;
      throw new Error('Unexpected repository');
    }),
  } as unknown as EntityManager;

  const loanChargesService = {
    isEligible: jest.fn().mockReturnValue(policyEligible),
    previewPaymentAllocation: jest.fn().mockReturnValue({
      eligible: policyEligible,
      cashReceived: 300,
      savingsUsed: 0,
      totalApplied: 300,
      penalty: { amount: 100, cashPortion: 100, savingsPortion: 0 },
      pastDueInterest: { amount: 20, cashPortion: 20, savingsPortion: 0 },
      contractual: { amount: 180, cashPortion: 180, savingsPortion: 0 },
      unapplied: 0,
    }),
    recordPaymentAllocation: jest.fn(async (loan: Loan) => {
      loan.penaltyPaid = 100;
      loan.pastDueInterestPaid = 20;
    }),
    getOutstanding: jest.fn().mockImplementation((loan: Loan) => ({
      penaltyOutstanding: Math.max(
        0,
        Number(loan.penaltyAccrued || 0) - Number(loan.penaltyPaid || 0),
      ),
      pastDueInterestOutstanding: Math.max(
        0,
        Number(loan.pastDueInterestAccrued || 0) -
          Number(loan.pastDueInterestPaid || 0),
      ),
      totalOutstanding: Math.max(
        0,
        Number(loan.penaltyAccrued || 0) -
          Number(loan.penaltyPaid || 0) +
          Number(loan.pastDueInterestAccrued || 0) -
          Number(loan.pastDueInterestPaid || 0),
      ),
    })),
  };
  const service = new LoansService(
    loanRepository as unknown as Repository<Loan>,
    {} as Repository<Member>,
    collectionRepository as unknown as Repository<Collection>,
    savingsRepository as unknown as Repository<Savings>,
    scheduleRepository as unknown as Repository<LoanRepaymentSchedule>,
    {} as Repository<LoanWaiver>,
    {
      resolveEnrollment: jest.fn().mockReturnValue(enrollment),
      isEligible: jest.fn().mockReturnValue(policyEligible),
    } as unknown as LoanChargePolicyService,
    loanChargesService as unknown as LoanChargesService,
  );

  return {
    service,
    loans,
    entries,
    manager,
    scheduleRepository,
    loanChargesService,
  };
}

describe('LoansService', () => {
  let service: LoansService;
  let loanRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
  };

  const buildLoan = (
    id: string,
    status: Loan['status'],
    savings: number,
    createdAt: Date,
  ) =>
    ({
      id,
      status,
      savings,
      createdAt,
    }) as Loan;

  beforeEach(async () => {
    loanRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        { provide: getRepositoryToken(Loan), useValue: loanRepository },
        { provide: getRepositoryToken(Member), useValue: {} },
        { provide: getRepositoryToken(Collection), useValue: {} },
        { provide: getRepositoryToken(Savings), useValue: {} },
        { provide: getRepositoryToken(LoanRepaymentSchedule), useValue: {} },
        { provide: getRepositoryToken(LoanWaiver), useValue: {} },
        {
          provide: LoanChargePolicyService,
          useValue: {
            resolveEnrollment: jest.fn().mockReturnValue(null),
            isEligible: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: LoanChargesService,
          useValue: { isEligible: jest.fn().mockReturnValue(false) },
        },
      ],
    }).compile();

    service = module.get<LoansService>(LoansService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('24-week monthly interest validation', () => {
    it('converts the supplied monthly rate into the six-month interest rate', () => {
      const result = (service as any).calculateLoanDetails(10_000, 24, 3.33);

      expect(result.interestRate).toBeCloseTo(0.1998);
      expect(result.totalAmount).toBeCloseTo(11_998);
    });

    it.each([undefined, 3.32, 10.01])(
      'rejects an invalid 24-week monthly interest rate of %p',
      (monthlyInterestRate) => {
        expect(() =>
          (service as any).calculateLoanDetails(
            10_000,
            24,
            monthlyInterestRate,
          ),
        ).toThrow();
      },
    );

    it('rejects a monthly rate on fixed-rate terms', () => {
      expect(() =>
        (service as any).calculateLoanDetails(10_000, 12, 35),
      ).toThrow();
    });

    it('uses the regular weekly amount while leaving the exact remainder for the final schedule row', () => {
      const result = (service as any).calculateLoanDetails(10_000, 24, 10);

      expect(result.totalAmount).toBe(16_000);
      expect(result.weeklyPaymentAmount).toBe(670);
    });
  });

  describe('authoritative savings loan selection', () => {
    it('selects the member only active loan', async () => {
      const active = buildLoan(
        'active',
        'active',
        5000,
        new Date('2026-01-01'),
      );
      loanRepository.find.mockResolvedValueOnce([active]);

      await expect(
        service.findAuthoritativeSavingsLoanForMember('member-1'),
      ).resolves.toBe(active);
    });

    it('prefers the active loan over historical loans', async () => {
      const active = buildLoan(
        'active',
        'active',
        7000,
        new Date('2026-02-01'),
      );
      loanRepository.find.mockResolvedValueOnce([active]);

      const selected =
        await service.findAuthoritativeSavingsLoanForMember('member-1');

      expect(selected).toBe(active);
      expect(loanRepository.find).toHaveBeenCalledTimes(1);
    });

    it('follows reloan carry-forward without summing historical snapshots', async () => {
      const activeReloan = buildLoan(
        'reloan',
        'active',
        7500,
        new Date('2026-03-01'),
      );
      loanRepository.find.mockResolvedValueOnce([activeReloan]);

      const selected =
        await service.findAuthoritativeSavingsLoanForMember('member-1');

      expect(Number(selected?.savings)).toBe(7500);
      expect(loanRepository.find).toHaveBeenCalledTimes(1);
    });

    it('uses the uniquely latest historical loan when no active loan exists', async () => {
      const latest = buildLoan('latest', 'paid', 6000, new Date('2026-02-01'));
      const older = buildLoan('older', 'payoff', 5000, new Date('2026-01-01'));
      loanRepository.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([latest, older]);

      await expect(
        service.findAuthoritativeSavingsLoanForMember('member-1'),
      ).resolves.toBe(latest);
    });

    it('returns null when the member has no loans', async () => {
      loanRepository.find.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await expect(
        service.findAuthoritativeSavingsLoanForMember('member-1'),
      ).resolves.toBeNull();
    });

    it('rejects multiple active loans as ambiguous', async () => {
      loanRepository.find.mockResolvedValueOnce([
        buildLoan('active-2', 'active', 6000, new Date('2026-02-01')),
        buildLoan('active-1', 'active', 5000, new Date('2026-01-01')),
      ]);

      await expect(
        service.findAuthoritativeSavingsLoanForMember('member-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects tied latest historical loans as ambiguous', async () => {
      const createdAt = new Date('2026-02-01');
      loanRepository.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          buildLoan('loan-2', 'paid', 6000, createdAt),
          buildLoan('loan-1', 'payoff', 5000, createdAt),
        ]);

      await expect(
        service.findAuthoritativeSavingsLoanForMember('member-1'),
      ).rejects.toThrow('latest loans have the same creation time');
    });
  });

  describe('financial retention', () => {
    it('rejects destructive deletion of a persisted loan', async () => {
      loanRepository.findOne.mockResolvedValue(
        buildLoan('loan-1', 'active', 5000, new Date('2026-01-01')),
      );

      await expect(service.remove('loan-1')).rejects.toThrow(ConflictException);

      expect(loanRepository.delete).not.toHaveBeenCalled();
    });

    it('preserves the not-found behavior for loan deletion', async () => {
      loanRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('missing-loan')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('savings ledger contribution classification', () => {
    const createDto = (savings: number) => ({
      borrowerId: 'member-1',
      principalAmount: 10_000,
      termWeeks: 8,
      savings,
      serviceCharge: 100,
      notarialFee: 50,
    });

    it('records a first normal loan contribution with complete snapshots', async () => {
      const harness = createLoanWriterHarness();

      const loan = await harness.service.create(
        createDto(500),
        'loan-processor-1',
      );

      expect(Number(loan.savings)).toBe(500);
      expect(harness.entries).toHaveLength(1);
      expect(harness.entries[0]).toMatchObject({
        eventType: SavingsEventType.LOAN_ORIGINATION_CONTRIBUTION,
        amount: 500,
        balanceBefore: 0,
        balanceAfter: 500,
        referenceType: 'loan',
        referenceId: loan.id,
        idempotencyKey: `loan:v1:${loan.id}:origination-contribution`,
        performedById: 'loan-processor-1',
      });
    });

    it('stores immutable policy enrollment on an eligible new loan', async () => {
      const harness = createLoanWriterHarness([], {
        version: 'DCLA_2026_V1',
        effectiveDate: '2026-10-01',
      });

      const loan = await harness.service.create({
        ...createDto(500),
        loanCreatedDate: '2026-10-01',
      });

      expect(loan).toMatchObject({
        overdueChargePolicyVersion: 'DCLA_2026_V1',
        overdueChargePolicyEffectiveDate: '2026-10-01',
      });
      expect(harness.scheduleRepository.save).toHaveBeenCalledTimes(1);
    });

    it('keeps legacy loans explicitly unenrolled', async () => {
      const harness = createLoanWriterHarness();
      const loan = await harness.service.create(createDto(500));

      expect(loan.overdueChargePolicyVersion).toBeNull();
      expect(loan.overdueChargePolicyEffectiveDate).toBeNull();
    });

    it('records only the new contribution for a later normal loan', async () => {
      const prior = {
        id: 'loan-1',
        status: 'paid',
        savings: 2000,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
      } as Loan;
      const harness = createLoanWriterHarness([prior]);

      const loan = await harness.service.create(createDto(300));

      expect(Number(loan.savings)).toBe(2300);
      expect(harness.entries).toHaveLength(1);
      expect(harness.entries[0]).toMatchObject({
        eventType: SavingsEventType.LOAN_ORIGINATION_CONTRIBUTION,
        amount: 300,
        balanceBefore: 2000,
        balanceAfter: 2300,
      });
    });

    it('does not create an event for a later normal-loan carry-forward', async () => {
      const prior = {
        id: 'loan-1',
        status: 'paid',
        savings: 2000,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
      } as Loan;
      const harness = createLoanWriterHarness([prior]);

      const loan = await harness.service.create(createDto(0));

      expect(Number(loan.savings)).toBe(2000);
      expect(harness.entries).toHaveLength(0);
    });

    it('classifies repeated reloan contributions exactly once without carry-forward events', async () => {
      const source = {
        id: 'loan-1',
        status: 'active',
        savings: 2000,
        balance: 4000,
        termWeeks: 12,
        weeksPaid: 8,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
      } as Loan;
      const harness = createLoanWriterHarness([source]);

      const first = await harness.service.reloan(
        source.id,
        {
          newPrincipalAmount: 12_000,
          newTermWeeks: 12,
          mode: 'netoff',
          serviceCharge: 100,
          notarialFee: 50,
          savings: 300,
        },
        'loan-processor-1',
      );
      first.newLoan.weeksPaid = 8;
      const second = await harness.service.reloan(first.newLoan.id, {
        newPrincipalAmount: 14_000,
        newTermWeeks: 12,
        mode: 'netoff',
        serviceCharge: 100,
        notarialFee: 50,
        savings: 200,
      });

      expect(Number(first.newLoan.savings)).toBe(2300);
      expect(Number(second.newLoan.savings)).toBe(2500);
      expect(harness.entries).toHaveLength(2);
      expect(
        harness.entries.map((entry) => [entry.eventType, entry.amount]),
      ).toEqual([
        [SavingsEventType.RELOAN_CONTRIBUTION, 300],
        [SavingsEventType.RELOAN_CONTRIBUTION, 200],
      ]);
      expect(
        harness.entries.some(
          (entry) =>
            entry.eventType === SavingsEventType.LOAN_ORIGINATION_CONTRIBUTION,
        ),
      ).toBe(false);
    });

    it('does not create a reloan event for zero additional contribution', async () => {
      const source = {
        id: 'loan-1',
        status: 'active',
        savings: 2000,
        balance: 4000,
        termWeeks: 12,
        weeksPaid: 8,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
      } as Loan;
      const harness = createLoanWriterHarness([source]);

      const result = await harness.service.reloan(source.id, {
        newPrincipalAmount: 12_000,
        newTermWeeks: 12,
        mode: 'payoff',
        serviceCharge: 100,
        notarialFee: 50,
        savings: 0,
      });

      expect(Number(result.newLoan.savings)).toBe(2000);
      expect(harness.entries).toHaveLength(0);
    });
  });

  describe('repayment savings debit ledger metadata', () => {
    const repaymentLoan = () =>
      ({
        id: 'loan-1',
        status: 'active',
        savings: 5000,
        balance: 12_000,
        totalAmount: 12_000,
        weeklyPaymentAmount: 3000,
        amountPaid: 0,
        weeksPaid: 0,
        advancePaymentBuffer: 0,
        termWeeks: 4,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
      }) as Loan;

    it('records the exact savings portion with deterministic repayment provenance', async () => {
      const harness = createLoanWriterHarness([repaymentLoan()]);

      await harness.service.applyRepayment('loan-1', 0, true, harness.manager, {
        repaymentId: '10000000-0000-4000-8000-000000000001',
        actorId: '20000000-0000-4000-8000-000000000001',
        businessDate: '2026-09-04',
      });

      expect(Number(harness.loans[0].savings)).toBe(2000);
      expect(harness.entries).toHaveLength(1);
      expect(harness.entries[0]).toMatchObject({
        eventType: SavingsEventType.REPAYMENT_DEBIT,
        amount: -3000,
        balanceBefore: 5000,
        balanceAfter: 2000,
        businessDate: '2026-09-04',
        referenceType: 'repayment',
        referenceId: '10000000-0000-4000-8000-000000000001',
        idempotencyKey:
          'repayment:v1:10000000-0000-4000-8000-000000000001:savings-debit',
        performedById: '20000000-0000-4000-8000-000000000001',
        reversalOfId: null,
      });
    });

    it('does not create a savings ledger row when no savings are consumed', async () => {
      const harness = createLoanWriterHarness([repaymentLoan()]);

      await harness.service.applyRepayment(
        'loan-1',
        3000,
        false,
        harness.manager,
        {
          repaymentId: '10000000-0000-4000-8000-000000000001',
          businessDate: '2026-09-04',
        },
      );

      expect(Number(harness.loans[0].savings)).toBe(5000);
      expect(harness.entries).toHaveLength(0);
    });
  });

  describe('policy-enrolled repayment allocation', () => {
    it('keeps charge payments out of contractual amountPaid and balance', async () => {
      const loan = {
        id: 'loan-1',
        status: 'active',
        weeklyPaymentAmount: 500,
        amountPaid: 0,
        balance: 1000,
        totalAmount: 1000,
        termWeeks: 2,
        weeksPaid: 0,
        advancePaymentBuffer: 0,
        savings: 0,
        existingSavings: 0,
        penaltyAccrued: 100,
        penaltyPaid: 0,
        penaltyWaived: 0,
        pastDueInterestAccrued: 20,
        pastDueInterestPaid: 0,
        pastDueInterestWaived: 0,
        overdueChargePolicyVersion: 'DCLA_2026_V1',
        overdueChargePolicyEffectiveDate: '2026-10-01',
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
      } as Loan;
      const harness = createLoanWriterHarness([loan], null, true);

      const result = await harness.service.applyRepaymentWithAllocation(
        loan.id,
        300,
        false,
        harness.manager,
        {
          repaymentId: '10000000-0000-4000-8000-000000000001',
          businessDate: '2026-10-10',
        },
      );

      expect(result.allocation.contractual.amount).toBe(180);
      expect(result.loan.amountPaid).toBe(180);
      expect(result.loan.balance).toBe(820);
      expect(result.loan.penaltyPaid).toBe(100);
      expect(result.loan.pastDueInterestPaid).toBe(20);
      expect(
        harness.loanChargesService.recordPaymentAllocation,
      ).toHaveBeenCalled();
    });
  });
});
