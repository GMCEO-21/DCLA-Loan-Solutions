import { EntityManager, Repository } from 'typeorm';
import { RepaymentsService } from './repayments.service';
import { Repayment, RepaymentStatus } from './repayment.entity';
import { Loan } from '../loans/loan.entity';
import { Member } from '../members/entities/member.entity';
import { Center } from '../centers/entities/center.entity';
import { Collection } from '../collections/entities/collection.entity';
import { LoanRepaymentSchedule } from './entities/loan-repayment-schedule.entity';
import { LoanRepaymentAllocation } from './entities/loan-repayment-allocation.entity';
import { CollectionBatch } from './entities/collection-batch.entity';
import { Savings } from '../savings/savings.entity';
import { LoansService } from '../loans/loans.service';
import { LoanChargesService } from '../loans/loan-charges.service';
import { LoanChargePolicyService } from '../loans/loan-charge-policy.service';
import { LoanChargeLedger } from '../loans/entities/loan-charge-ledger.entity';
import { LoanWaiver } from '../loans/entities/loan-waiver.entity';

function createPaymentLimitCharges() {
  return new LoanChargesService(
    {} as Repository<Loan>,
    {} as Repository<LoanChargeLedger>,
    {} as Repository<LoanRepaymentSchedule>,
    {} as Repository<LoanWaiver>,
    {
      isEligible: (loan: Loan) => Boolean(loan.overdueChargePolicyVersion),
    } as LoanChargePolicyService,
  );
}

function harness() {
  const center = { id: 'center' } as Center;
  const member = { id: 'member', center } as Member;
  const loan = {
    id: 'loan',
    borrower: member,
    status: 'active',
    balance: 450,
    savings: 500,
    weeklyPaymentAmount: 550,
    penaltyAccrued: 0,
    penaltyPaid: 0,
    penaltyWaived: 0,
    pastDueInterestAccrued: 0,
    pastDueInterestPaid: 0,
    pastDueInterestWaived: 0,
  } as Loan;
  let pending: Repayment[] = [];
  const builder = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(loan),
  };
  const loanRepository = {
    createQueryBuilder: jest.fn(() => builder),
    findOne: jest.fn(() => Promise.resolve({ ...loan })),
    find: jest.fn(() => Promise.resolve([loan])),
  };
  const repaymentRepository = {
    find: jest.fn(() => Promise.resolve(pending)),
    create: jest.fn((value: Partial<Repayment>) => value),
    save: jest.fn((value: Repayment) => Promise.resolve(value)),
  };
  const batchRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((value: Partial<CollectionBatch>) => value),
    save: jest.fn((value: CollectionBatch) =>
      Promise.resolve({ ...value, id: 'batch' }),
    ),
  };
  const manager = {
    getRepository: (entity: unknown) => {
      if (entity === Loan) return loanRepository;
      if (entity === Repayment) return repaymentRepository;
      if (entity === CollectionBatch) return batchRepository;
      if (entity === Member) return { findOne: () => Promise.resolve(member) };
      if (entity === Center) return { findOne: () => Promise.resolve(center) };
      throw new Error('Unexpected entity');
    },
    transaction: async <Result>(
      work: (transaction: EntityManager) => Promise<Result>,
    ) => {
      const snapshot = { ...loan };
      try {
        return await work(manager as unknown as EntityManager);
      } catch (error) {
        Object.assign(loan, snapshot);
        throw error;
      }
    },
  };
  const charges = createPaymentLimitCharges();
  const project = jest
    .spyOn(charges, 'postDueChargesForLoan')
    .mockImplementation(() => {
      loan.penaltyAccrued = 100;
      return Promise.resolve({ chargeCount: 1, skippedPendingCount: 0 });
    });
  const service = new RepaymentsService(
    { manager } as unknown as Repository<Repayment>,
    {} as Repository<Loan>,
    {} as Repository<Member>,
    {} as Repository<Center>,
    {} as Repository<Collection>,
    {} as Repository<LoanRepaymentSchedule>,
    {} as Repository<LoanRepaymentAllocation>,
    {} as Repository<Savings>,
    {} as Repository<CollectionBatch>,
    {} as LoansService,
    charges,
  );
  const submit = (amount: number, useSavings = false) =>
    service.create(
      {
        loanId: 'loan',
        memberId: 'member',
        centerId: 'center',
        amount,
        useSavings,
        collectionDate: '2026-10-29',
      },
      { role: 'cashier' },
    );
  return {
    service,
    submit,
    loan,
    builder,
    repaymentRepository,
    batchRepository,
    project,
    setPending: (values: Repayment[]) => {
      pending = values;
    },
  };
}

describe('Repayment submission guards', () => {
  it('rejects excessive cash before a posting or batch is created', async () => {
    const test = harness();
    await expect(test.submit(550)).rejects.toThrow(
      'Maximum cash payment is 450.00',
    );
    expect(test.repaymentRepository.save).not.toHaveBeenCalled();
    expect(test.batchRepository.save).not.toHaveBeenCalled();
    expect(test.builder.setLock).toHaveBeenCalledWith('pessimistic_write');
  });

  it('accepts the exact final amount as pending without changing the balance', async () => {
    const test = harness();
    await expect(test.submit(450)).resolves.toMatchObject({
      status: RepaymentStatus.PENDING,
      amount: 450,
    });
    expect(test.loan.balance).toBe(450);
  });

  it('accepts an advance larger than the weekly installment', async () => {
    const test = harness();
    test.loan.balance = 6500;
    await expect(test.submit(1100)).resolves.toMatchObject({ amount: 1100 });
  });

  it('reserves pending payments but does not reserve rejected payments or reversals', async () => {
    const test = harness();
    test.setPending([{ amount: 350 }] as Repayment[]);
    await expect(test.submit(100.01)).rejects.toThrow(
      'Maximum cash payment is 100.00',
    );
    await expect(test.submit(100)).resolves.toMatchObject({ amount: 100 });
    expect(test.repaymentRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          loan: { id: 'loan' },
          status: 'pending',
          operationType: 'payment',
        },
      }),
    );
  });

  it.each([Infinity, NaN, -1, 450.001])(
    'rejects invalid cash %s',
    async (amount) => {
      await expect(harness().submit(amount)).rejects.toThrow();
    },
  );

  it('rejects payments on a settled loan', async () => {
    const test = harness();
    test.loan.status = 'paid';
    await expect(test.submit(1)).rejects.toThrow('non-active loan');
  });

  it('supports zero cash plus savings but not a fully reserved loan', async () => {
    const test = harness();
    await expect(test.submit(0, true)).resolves.toMatchObject({
      amount: 0,
      useSavings: true,
    });
    test.setPending([{ amount: 450 }] as Repayment[]);
    await expect(test.submit(0, true)).rejects.toThrow(
      'No savings or remaining payable',
    );
  });

  it('projects enrolled charges and rolls back accruals before saving a pending payment', async () => {
    const test = harness();
    test.loan.overdueChargePolicyVersion = 'DCLA_2026_V1';
    await expect(test.submit(550)).resolves.toMatchObject({ amount: 550 });
    expect(test.project).toHaveBeenCalled();
    expect(test.loan.penaltyAccrued).toBe(0);
  });

  it('fails closed when charge projection fails', async () => {
    const test = harness();
    test.loan.overdueChargePolicyVersion = 'DCLA_2026_V1';
    test.project.mockRejectedValueOnce(new Error('Projection failed'));
    await expect(test.submit(100)).rejects.toThrow('Projection failed');
    expect(test.repaymentRepository.save).not.toHaveBeenCalled();
  });
});
