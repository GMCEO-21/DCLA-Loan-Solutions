/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { EntityManager, Repository } from 'typeorm';
import { Center } from '../centers/entities/center.entity';
import { Collection } from '../collections/entities/collection.entity';
import { Loan } from '../loans/loan.entity';
import { LoansService } from '../loans/loans.service';
import { Member } from '../members/entities/member.entity';
import { Savings, SavingsEventType } from '../savings/savings.entity';
import {
  Repayment,
  RepaymentOperationType,
  RepaymentStatus,
} from './repayment.entity';
import { RepaymentsService } from './repayments.service';
import { CollectionBatch } from './entities/collection-batch.entity';
import { LoanRepaymentAllocation } from './entities/loan-repayment-allocation.entity';
import { LoanChargesService } from '../loans/loan-charges.service';
import {
  LoanRepaymentSchedule,
  LoanRepaymentStatus,
} from './entities/loan-repayment-schedule.entity';

function createReversalHarness(savingsPortion: number) {
  const center = { id: 'center-1' } as Center;
  const member = { id: 'member-1', center } as Member;
  const loan = {
    id: 'loan-1',
    borrower: member,
    status: 'active',
    amountPaid: 3000,
    balance: 9000,
    totalAmount: 12_000,
    weeklyPaymentAmount: 3000,
    weeksPaid: 1,
    advancePaymentBuffer: 0,
    savings: 2000,
  } as Loan;
  const original = {
    id: '10000000-0000-4000-8000-000000000001',
    loan,
    member,
    center,
    amount: 0,
    collectionDate: '2026-09-03',
    operationType: RepaymentOperationType.PAYMENT,
    status: RepaymentStatus.APPROVED,
    createdAt: new Date('2026-09-03T00:00:00.000Z'),
  } as Repayment;
  const reversal = {
    id: '10000000-0000-4000-8000-000000000002',
    loan,
    member,
    center,
    amount: 0,
    collectionDate: '2026-09-04',
    operationType: RepaymentOperationType.REVERSAL,
    relatedRepaymentId: original.id,
    status: RepaymentStatus.PENDING,
    createdAt: new Date('2026-09-04T00:00:00.000Z'),
  } as Repayment;
  const allocation = {
    repaymentId: original.id,
    scheduleId: 'schedule-1',
    amountApplied: 3000,
    cashPortion: 3000 - savingsPortion,
    savingsPortion,
  } as LoanRepaymentAllocation;
  const schedule = {
    id: 'schedule-1',
    amountDue: 3000,
    amountPaid: 3000,
    dueDate: '2026-09-03',
    status: LoanRepaymentStatus.PAID,
  } as LoanRepaymentSchedule;
  const originalDebit = {
    id: '30000000-0000-4000-8000-000000000001',
    eventType: SavingsEventType.REPAYMENT_DEBIT,
    amount: -savingsPortion,
  } as Savings;
  const savedEntries: Savings[] = [];

  const queryBuilder: any = {
    setLock: jest.fn(() => queryBuilder),
    where: jest.fn(() => queryBuilder),
    getOne: jest.fn().mockResolvedValue(null),
  };
  const repaymentRepository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    findOne: jest.fn(async (options: any) => {
      if (options.where.id === original.id) return original;
      return null;
    }),
    save: jest.fn(async (value: Repayment) => value),
  };
  const loanRepository = { save: jest.fn(async (value: Loan) => value) };
  const allocationRepository = {
    find: jest.fn().mockResolvedValue([allocation]),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const scheduleRepository = {
    find: jest.fn().mockResolvedValue([schedule]),
    save: jest.fn(async (value: LoanRepaymentSchedule[]) => value),
  };
  const savingsRepository = {
    findOne: jest
      .fn()
      .mockResolvedValue(savingsPortion > 0 ? originalDebit : null),
    create: jest.fn((value: Partial<Savings>) => value as Savings),
    save: jest.fn(async (value: Savings) => {
      savedEntries.push(value);
      return value;
    }),
  };
  const collectionRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
  };
  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === Repayment) return repaymentRepository;
      if (entity === Loan) return loanRepository;
      if (entity === LoanRepaymentAllocation) return allocationRepository;
      if (entity === LoanRepaymentSchedule) return scheduleRepository;
      if (entity === Savings) return savingsRepository;
      if (entity === Collection) return collectionRepository;
      throw new Error('Unexpected repository');
    }),
  } as unknown as EntityManager;
  const service = new RepaymentsService(
    {} as Repository<Repayment>,
    {} as Repository<Loan>,
    {} as Repository<Member>,
    {} as Repository<Center>,
    {} as Repository<Collection>,
    {} as Repository<LoanRepaymentSchedule>,
    {} as Repository<LoanRepaymentAllocation>,
    {} as Repository<Savings>,
    {} as Repository<CollectionBatch>,
    {} as LoansService,
    {
      reversePaymentAllocation: jest.fn().mockResolvedValue({
        penaltyReversed: 0,
        pastDueInterestReversed: 0,
        cashReversed: 0,
        savingsReversed: 0,
        totalReversed: 0,
      }),
      getOutstanding: jest.fn().mockReturnValue({
        penaltyOutstanding: 0,
        pastDueInterestOutstanding: 0,
        totalOutstanding: 0,
      }),
      isEligible: jest.fn().mockReturnValue(false),
    } as unknown as LoanChargesService,
  );

  return {
    service,
    manager,
    loan,
    original,
    reversal,
    originalDebit,
    savedEntries,
    savingsRepository,
  };
}

describe('RepaymentsService savings reversal ledger', () => {
  it('links a complete reversal credit to the exact original debit', async () => {
    const harness = createReversalHarness(3000);

    await (harness.service as any).approveReversalRepayment(
      harness.reversal,
      harness.loan,
      harness.manager,
      '2026-09-04',
      '20000000-0000-4000-8000-000000000001',
    );

    expect(Number(harness.loan.savings)).toBe(5000);
    expect(harness.savingsRepository.findOne).toHaveBeenCalledWith({
      where: {
        eventType: SavingsEventType.REPAYMENT_DEBIT,
        idempotencyKey:
          'repayment:v1:10000000-0000-4000-8000-000000000001:savings-debit',
      },
    });
    expect(harness.savedEntries).toHaveLength(1);
    expect(harness.savedEntries[0]).toMatchObject({
      eventType: SavingsEventType.REPAYMENT_REVERSAL_CREDIT,
      amount: 3000,
      balanceBefore: 2000,
      balanceAfter: 5000,
      businessDate: '2026-09-04',
      referenceType: 'repayment_reversal',
      referenceId: harness.reversal.id,
      idempotencyKey:
        'repayment:v1:10000000-0000-4000-8000-000000000002:savings-reversal-credit',
      performedById: '20000000-0000-4000-8000-000000000001',
      reversalOfId: harness.originalDebit.id,
    });
  });

  it('does not create a reversal-credit row when no savings are restored', async () => {
    const harness = createReversalHarness(0);

    await (harness.service as any).approveReversalRepayment(
      harness.reversal,
      harness.loan,
      harness.manager,
      '2026-09-04',
    );

    expect(harness.savedEntries).toHaveLength(0);
    expect(harness.savingsRepository.findOne).not.toHaveBeenCalled();
  });
});
