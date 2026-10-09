/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { Loan } from '../loans/loan.entity';
import { Member } from '../members/entities/member.entity';
import { Savings, SavingsEventType } from './savings.entity';
import { SavingsService } from './savings.service';
import { DepositSavingsDto } from './dto/deposit-savings.dto';
import { LoansService } from '../loans/loans.service';

interface HarnessState {
  loan: Loan;
  entries: Savings[];
}

function createHarness(initialSavings = 5000) {
  const member = { id: 'member-1' } as Member;
  let state: HarnessState = {
    loan: {
      id: 'loan-1',
      borrower: member,
      status: 'active',
      savings: initialSavings,
    } as Loan,
    entries: [],
  };
  let failLoanSave = false;
  let transactionTail = Promise.resolve();
  const lockModes: string[] = [];

  const transaction = jest.fn(
    <T>(work: (manager: EntityManager) => Promise<T>): Promise<T> => {
      const result = transactionTail.then(async () => {
        const transactionState: HarnessState = {
          loan: { ...state.loan },
          entries: [...state.entries],
        };
        const queryBuilder: any = {
          setLock: jest.fn((mode: string) => {
            lockModes.push(mode);
            return queryBuilder;
          }),
          where: jest.fn(() => queryBuilder),
          andWhere: jest.fn(() => queryBuilder),
          getOne: jest.fn(async () => transactionState.loan),
        };
        const loanRepository = {
          createQueryBuilder: jest.fn(() => queryBuilder),
          findOne: jest.fn(async () => transactionState.loan),
          save: jest.fn(async (loan: Loan) => {
            if (failLoanSave) {
              throw new Error('loan update failed');
            }
            transactionState.loan = { ...loan };
            return loan;
          }),
        };
        const savingsRepository = {
          create: jest.fn((entry: Partial<Savings>) => ({
            id: `entry-${transactionState.entries.length + 1}`,
            createdAt: new Date('2026-09-02T00:00:00.000Z'),
            updatedAt: new Date('2026-09-02T00:00:00.000Z'),
            ...entry,
          })),
          save: jest.fn(async (entry: Savings) => {
            transactionState.entries.push(entry);
            return entry;
          }),
        };
        const manager = {
          getRepository: jest.fn((entity) => {
            if (entity === Member) {
              return { findOne: jest.fn(async () => member) };
            }
            if (entity === Loan) {
              return loanRepository;
            }
            if (entity === Savings) {
              return savingsRepository;
            }
            throw new Error('Unexpected repository');
          }),
        } as unknown as EntityManager;

        const value = await work(manager);
        state = transactionState;
        return value;
      });
      transactionTail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  );

  const loanRepository = {
    manager: { transaction },
  } as unknown as Repository<Loan>;
  const service = new SavingsService(
    {} as Repository<Savings>,
    {} as Repository<Member>,
    loanRepository,
    {} as LoansService,
  );

  return {
    service,
    getState: () => state,
    lockModes,
    setFailLoanSave: (value: boolean) => {
      failLoanSave = value;
    },
  };
}

function createSummaryHarness(
  authoritativeLoan: Loan | null,
  entries: Savings[] = [],
  selectorError?: Error,
) {
  const savingsRepository = {
    find: jest.fn(async () => entries),
  } as unknown as Repository<Savings>;
  const memberRepository = {
    findOne: jest.fn(async () => ({ id: 'member-1' }) as Member),
  } as unknown as Repository<Member>;
  const findAuthoritativeSavingsLoanForMember = selectorError
    ? jest.fn(async () => {
        throw selectorError;
      })
    : jest.fn(async () => authoritativeLoan);
  const loansService = {
    findAuthoritativeSavingsLoanForMember,
  } as unknown as LoansService;
  const service = new SavingsService(
    savingsRepository,
    memberRepository,
    {} as Repository<Loan>,
    loansService,
  );

  return { service, findAuthoritativeSavingsLoanForMember };
}

describe('SavingsService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-03T16:30:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('atomically deposits a positive entry and updates loan.savings', async () => {
    const harness = createHarness();

    const spoofedDto: DepositSavingsDto & { performedById: string } = {
      memberId: 'member-1',
      loanId: 'loan-1',
      amount: 1000,
      remarks: 'Manual deposit',
      performedById: 'spoofed-actor',
    };
    const result = await harness.service.deposit(
      spoofedDto,
      'authenticated-actor',
    );

    expect(result.loan.savings).toBe(6000);
    expect(result.entry).toMatchObject({
      borrowerId: 'member-1',
      loanId: 'loan-1',
      amount: 1000,
      remarks: 'Manual deposit',
    });
    expect(result.entry).not.toHaveProperty('eventType');
    expect(result.entry).not.toHaveProperty('balanceBefore');
    expect(result.entry).not.toHaveProperty('performedById');
    expect(harness.getState().loan.savings).toBe(6000);
    expect(harness.getState().entries).toHaveLength(1);
    expect(harness.getState().entries[0]).toMatchObject({
      eventType: SavingsEventType.MANUAL_DEPOSIT,
      amount: 1000,
      balanceBefore: 5000,
      balanceAfter: 6000,
      businessDate: '2026-09-04',
      performedById: 'authenticated-actor',
      idempotencyKey: null,
      reversalOfId: null,
    });
    expect(harness.lockModes).toEqual(['pessimistic_write']);
  });

  it('atomically withdraws a negative entry and updates loan.savings', async () => {
    const harness = createHarness();

    const result = await harness.service.withdraw(
      {
        memberId: 'member-1',
        loanId: 'loan-1',
        amount: 2000,
        remarks: 'Manual withdrawal',
      },
      'authenticated-actor',
    );

    expect(result.loan.savings).toBe(3000);
    expect(harness.getState().entries[0]).toMatchObject({
      eventType: SavingsEventType.MANUAL_WITHDRAWAL,
      amount: -2000,
      balanceBefore: 5000,
      balanceAfter: 3000,
      businessDate: '2026-09-04',
      performedById: 'authenticated-actor',
      idempotencyKey: null,
      reversalOfId: null,
    });
  });

  it('retains the existing insufficient-savings behavior', async () => {
    const harness = createHarness();

    await expect(
      harness.service.withdraw({
        memberId: 'member-1',
        loanId: 'loan-1',
        amount: 6000,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(harness.getState().loan.savings).toBe(5000);
    expect(harness.getState().entries).toHaveLength(0);
  });

  it.each([
    ['deposit', 1000],
    ['withdraw', 1000],
  ] as const)(
    'rolls back the %s entry when the balance update fails',
    async (operation, amount) => {
      const harness = createHarness();
      harness.setFailLoanSave(true);

      await expect(
        harness.service[operation]({
          memberId: 'member-1',
          loanId: 'loan-1',
          amount,
        }),
      ).rejects.toThrow('loan update failed');
      expect(harness.getState().loan.savings).toBe(5000);
      expect(harness.getState().entries).toHaveLength(0);
    },
  );

  it('serializes two deposits without a lost update', async () => {
    const harness = createHarness();

    await Promise.all([
      harness.service.deposit({
        memberId: 'member-1',
        loanId: 'loan-1',
        amount: 1000,
      }),
      harness.service.deposit({
        memberId: 'member-1',
        loanId: 'loan-1',
        amount: 1000,
      }),
    ]);

    expect(harness.getState().loan.savings).toBe(7000);
    expect(harness.getState().entries.map((entry) => entry.amount)).toEqual([
      1000, 1000,
    ]);
    expect(
      harness.getState().entries.every((entry) => !entry.idempotencyKey),
    ).toBe(true);
  });

  it('serializes withdrawals so only one can spend the same balance', async () => {
    const harness = createHarness();

    const results = await Promise.allSettled([
      harness.service.withdraw({
        memberId: 'member-1',
        loanId: 'loan-1',
        amount: 4000,
      }),
      harness.service.withdraw({
        memberId: 'member-1',
        loanId: 'loan-1',
        amount: 4000,
      }),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(harness.getState().loan.savings).toBe(1000);
    expect(harness.getState().entries).toHaveLength(1);
  });

  it('serializes a deposit and withdrawal without losing either mutation', async () => {
    const harness = createHarness();

    await Promise.all([
      harness.service.deposit({
        memberId: 'member-1',
        loanId: 'loan-1',
        amount: 1000,
      }),
      harness.service.withdraw({
        memberId: 'member-1',
        loanId: 'loan-1',
        amount: 2000,
      }),
    ]);

    expect(harness.getState().loan.savings).toBe(4000);
    expect(harness.getState().entries.map((entry) => entry.amount)).toEqual([
      1000, -2000,
    ]);
  });

  describe('member savings summary', () => {
    it('returns the active authoritative loan savings and mutation eligibility', async () => {
      const loan = {
        id: 'active-loan',
        status: 'active',
        savings: 2500,
      } as Loan;
      const { service, findAuthoritativeSavingsLoanForMember } =
        createSummaryHarness(loan);

      await expect(service.findByMember('member-1')).resolves.toMatchObject({
        currentSavings: 2500,
        activeLoanSavings: 2500,
        activeLoanId: 'active-loan',
        hasActiveLoan: true,
      });
      expect(findAuthoritativeSavingsLoanForMember).toHaveBeenCalledWith(
        'member-1',
      );
    });

    it('exposes retained savings from the authoritative historical loan without mutation eligibility', async () => {
      const loan = {
        id: 'completed-loan',
        status: 'paid',
        savings: 3500,
      } as Loan;
      const { service } = createSummaryHarness(loan);

      await expect(service.findByMember('member-1')).resolves.toMatchObject({
        currentSavings: 3500,
        activeLoanSavings: 0,
        activeLoanId: null,
        hasActiveLoan: false,
      });
    });

    it('returns zero for a member who has never had a loan', async () => {
      const { service } = createSummaryHarness(null);

      await expect(service.findByMember('member-1')).resolves.toMatchObject({
        currentSavings: 0,
        activeLoanSavings: 0,
        activeLoanId: null,
        hasActiveLoan: false,
      });
    });

    it('uses only the current authoritative reloan snapshot', async () => {
      const newLoan = {
        id: 'new-loan',
        status: 'active',
        savings: 3500,
      } as Loan;
      const historicalEntry = {
        amount: 3000,
        borrower: { id: 'member-1' },
        loan: { id: 'old-loan' },
      } as Savings;
      const { service } = createSummaryHarness(newLoan, [historicalEntry]);

      const result = await service.findByMember('member-1');

      expect(result.currentSavings).toBe(3500);
      expect(result.currentSavings).not.toBe(6500);
      expect(result.totalDeposits).toBe(3000);
    });

    it.each([
      'Authoritative savings balance is ambiguous because the member has multiple active loans',
      'Authoritative savings balance is ambiguous because the latest loans have the same creation time',
    ])('preserves selector conflict: %s', async (message) => {
      const { service } = createSummaryHarness(
        null,
        [],
        new ConflictException(message),
      );

      await expect(service.findByMember('member-1')).rejects.toThrow(message);
    });
  });
});
