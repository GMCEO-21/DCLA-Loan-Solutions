import { Test, TestingModule } from '@nestjs/testing';
import { aggregateLoanConditions, MembersService } from './members.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { Member } from './entities/member.entity';
import { Center } from '../centers/entities/center.entity';
import { Loan } from '../loans/loan.entity';
import {
  Repayment,
  RepaymentOperationType,
  RepaymentStatus,
} from '../repayments/repayment.entity';
import { Savings } from '../savings/savings.entity';
import { Collection } from '../collections/entities/collection.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('MembersService', () => {
  let service: MembersService;
  let manager: {
    findOne: jest.Mock;
    exists: jest.Mock;
    delete: jest.Mock;
  };
  let memberRepository: { find: jest.Mock; createQueryBuilder: jest.Mock };
  let loanRepository: { createQueryBuilder: jest.Mock; query: jest.Mock };
  let scheduleFind: jest.Mock;
  let repaymentFind: jest.Mock;
  let savingsFind: jest.Mock;

  const approvedAllocation = (
    amountApplied: number,
    paymentDate = '2026-10-17',
  ) => ({
    amountApplied,
    repayment: {
      status: RepaymentStatus.APPROVED,
      operationType: RepaymentOperationType.PAYMENT,
      paymentDate,
    },
  });

  const scheduleSeries = (
    loanId: string,
    startDate: string,
    amounts: number[],
  ): Array<{
    loanId: string;
    weekNumber: number;
    dueDate: string;
    amountDue: number;
    allocations: ReturnType<typeof approvedAllocation>[];
  }> =>
    amounts.map((amountDue, index) => {
      const dueDate = new Date(`${startDate}T00:00:00.000Z`);
      dueDate.setUTCDate(dueDate.getUTCDate() + index * 7);
      return {
        loanId,
        weekNumber: index + 1,
        dueDate: dueDate.toISOString().slice(0, 10),
        amountDue,
        allocations: [],
      };
    });

  beforeEach(async () => {
    scheduleFind = jest.fn().mockResolvedValue([]);
    repaymentFind = jest.fn().mockResolvedValue([]);
    savingsFind = jest.fn().mockResolvedValue([]);
    manager = {
      findOne: jest.fn().mockResolvedValue({ id: 'member-1' } as Member),
      exists: jest.fn().mockResolvedValue(false),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const dataSource = {
      getRepository: jest.fn().mockReturnValue({ find: scheduleFind }),
      transaction: jest.fn(
        (callback: (entityManager: typeof manager) => unknown) =>
          callback(manager),
      ),
    };
    memberRepository = { find: jest.fn(), createQueryBuilder: jest.fn() };
    loanRepository = { createQueryBuilder: jest.fn(), query: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: getRepositoryToken(Member), useValue: memberRepository },
        { provide: getRepositoryToken(Center), useValue: {} },
        { provide: getRepositoryToken(Loan), useValue: loanRepository },
        {
          provide: getRepositoryToken(Repayment),
          useValue: { find: repaymentFind },
        },
        {
          provide: getRepositoryToken(Savings),
          useValue: { find: savingsFind },
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
  });

  async function projectLoanCondition({
    selectedDate,
    schedules,
    repayments = [],
    loanOverrides = {},
  }: {
    selectedDate: string;
    schedules: ReturnType<typeof scheduleSeries>;
    repayments?: Partial<Repayment>[];
    loanOverrides?: Partial<Loan>;
  }) {
    const member = {
      id: 'member-1',
      center: { id: 'center-1', collectionDay: 'Tuesday' },
    } as Member;
    const loan = {
      id: 'loan-1',
      borrower: member,
      status: 'active',
      principalAmount: 2000,
      totalAmount: 3000,
      weeklyPaymentAmount: 1500,
      termWeeks: schedules.length,
      balance: 3000,
      overdueChargePolicyVersion: null,
      overdueChargePolicyEffectiveDate: null,
      ...loanOverrides,
    } as Loan;
    memberRepository.find.mockResolvedValue([member]);
    loanRepository.createQueryBuilder.mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([loan]),
    });
    scheduleFind.mockResolvedValue(schedules);
    repaymentFind.mockResolvedValue(
      repayments.map((repayment) => ({ ...repayment, loan })),
    );
    const releaseDate = loan.loanCreatedDate;
    loanRepository.query.mockResolvedValue(
      releaseDate
        ? [
            {
              loanId: loan.id,
              releaseDate:
                releaseDate instanceof Date
                  ? releaseDate.toISOString().slice(0, 10)
                  : String(releaseDate).slice(0, 10),
            },
          ]
        : [],
    );

    const [result] = await service.getCenterMembers('center-1', selectedDate);
    return result;
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects deletion without deleting a member savings history', async () => {
    manager.exists.mockImplementation((entity) =>
      Promise.resolve(entity === Savings),
    );

    await expect(service.remove('member-1')).rejects.toThrow(ConflictException);

    expect(manager.delete).not.toHaveBeenCalled();
  });

  it.each([
    ['loan', Loan],
    ['repayment', Repayment],
  ])(
    'rejects deletion when a member has %s history',
    async (_label, entity) => {
      manager.exists.mockImplementation((candidate) =>
        Promise.resolve(candidate === entity),
      );

      await expect(service.remove('member-1')).rejects.toThrow(
        'Member cannot be deleted because financial history exists',
      );

      expect(manager.delete).not.toHaveBeenCalled();
    },
  );

  it('rejects deletion when a member has collection history', async () => {
    manager.exists.mockImplementation((entity) =>
      Promise.resolve(entity === Collection),
    );

    await expect(service.remove('member-1')).rejects.toThrow(ConflictException);

    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('hard deletes only the pristine member row', async () => {
    await service.remove('member-1');

    expect(manager.findOne).toHaveBeenCalledWith(Member, {
      where: { id: 'member-1' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.delete).toHaveBeenCalledTimes(1);
    expect(manager.delete).toHaveBeenCalledWith(Member, { id: 'member-1' });
  });

  it('preserves the not-found behavior', async () => {
    manager.findOne.mockResolvedValue(null);

    await expect(service.remove('missing-member')).rejects.toThrow(
      NotFoundException,
    );

    expect(manager.exists).not.toHaveBeenCalled();
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('loads center loans in one batch without changing the response aggregates', async () => {
    const members = [
      { id: 'member-1', center: { id: 'center-1' } },
      { id: 'member-2', center: { id: 'center-1' } },
    ] as Member[];
    const loans = [
      {
        id: 'loan-1',
        borrower: members[0],
        status: 'active',
        principalAmount: 1000,
        balance: 700,
        totalAmount: 1200,
        weeklyPaymentAmount: 100,
        termWeeks: 12,
        savings: 50,
        netCashReleased: 900,
      },
      {
        id: 'loan-2',
        borrower: members[1],
        status: 'paid',
        principalAmount: 500,
        balance: 0,
      },
    ] as Loan[];
    const queryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(loans),
    };
    memberRepository.find.mockResolvedValue(members);
    loanRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.getCenterMembers('center-1', '2026-09-05');

    expect(memberRepository.find).toHaveBeenCalledTimes(1);
    expect(loanRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(queryBuilder.getMany).toHaveBeenCalledTimes(1);
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'borrower.id IN (:...memberIds)',
      { memberIds: ['member-1', 'member-2'] },
    );
    expect(result[0]).toMatchObject({
      id: 'member-1',
      totalLoanAmount: 1000,
      totalBalance: 700,
      overallAmount: 1200,
      weeklyPaymentAmount: 100,
      totalSavings: 50,
      netCashReleased: 900,
    });
    expect(result[0].loans[0]).not.toHaveProperty('borrower');
    expect(result[1].loans).toHaveLength(1);
  });

  it.each([
    ['2026-10-17', true],
    ['2026-10-18', true],
    ['2026-10-19', true],
    ['2026-10-20', true],
    ['2026-10-21', true],
    ['2026-10-22', true],
    ['2026-10-23', true],
    ['2026-10-24', false],
  ])(
    'projects the selected week for %s without changing member population or amounts',
    async (selectedDate, expectedPaid) => {
      const member = { id: 'member-1', center: { id: 'center-1' } } as Member;
      const loan = {
        id: 'loan-1',
        borrower: member,
        status: 'active',
        principalAmount: 3000,
        balance: 1500,
        totalAmount: 3500,
        weeklyPaymentAmount: 1500,
        termWeeks: 2,
      } as Loan;
      memberRepository.find.mockResolvedValue([member]);
      loanRepository.createQueryBuilder.mockReturnValue({
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([loan]),
      });
      const schedules = scheduleSeries(loan.id, '2026-10-17', [1500, 1500]);
      schedules[0].allocations = [approvedAllocation(1500)];
      scheduleFind.mockResolvedValue(schedules);

      const result = await service.getCenterMembers('center-1', selectedDate);

      expect(scheduleFind).toHaveBeenCalledWith({
        where: {
          loanId: In([loan.id]),
        },
        relations: ['allocations', 'allocations.repayment'],
      });
      expect(result.map(({ id }) => id)).toEqual(['member-1']);
      expect(result[0]).toMatchObject({
        totalLoanAmount: 3000,
        totalBalance: 1500,
        weeklyPaid: expectedPaid,
        weeklyHasAllocation: expectedPaid,
        weeklyAmountDue: 1500,
        weeklyAmountApplied: expectedPaid ? 1500 : 0,
        weeklyFinancial: {
          kind: 'scheduled_week',
          amountDue: 1500,
          amountApplied: expectedPaid ? 1500 : 0,
          postMaturityLoanCount: 0,
          incompleteScheduleLoanCount: 0,
        },
      });
    },
  );

  it('preserves member population when the selected week has no schedule', async () => {
    const members = [
      { id: 'member-1', center: { id: 'center-1' } },
      { id: 'member-2', center: { id: 'center-1' } },
    ] as Member[];
    const loans = members.map(
      (member, index) =>
        ({
          id: `loan-${index + 1}`,
          borrower: member,
          status: 'active',
          principalAmount: 3000,
          balance: 3000,
          weeklyPaymentAmount: 1500,
        }) as Loan,
    );
    memberRepository.find.mockResolvedValue(members);
    loanRepository.createQueryBuilder.mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(loans),
    });
    scheduleFind.mockResolvedValue([]);

    const result = await service.getCenterMembers('center-1', '2026-10-20');

    expect(result.map(({ id }) => id)).toEqual(['member-1', 'member-2']);
    expect(result).toHaveLength(2);
    expect(result.map(({ weeklyPaid }) => weeklyPaid)).toEqual([null, null]);
    expect(result.map(({ weeklyAmountDue }) => weeklyAmountDue)).toEqual([
      null,
      null,
    ]);
    expect(
      result.map(({ weeklyAmountApplied }) => weeklyAmountApplied),
    ).toEqual([null, null]);
  });

  it('projects partial weekly amounts without using cumulative loan values', async () => {
    const member = { id: 'member-1', center: { id: 'center-1' } } as Member;
    const loan = {
      id: 'loan-1',
      borrower: member,
      status: 'active',
      amountPaid: 9999,
      balance: 1,
      termWeeks: 1,
    } as Loan;
    memberRepository.find.mockResolvedValue([member]);
    loanRepository.createQueryBuilder.mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([loan]),
    });
    scheduleFind.mockResolvedValue([
      {
        loanId: loan.id,
        weekNumber: 1,
        dueDate: '2026-10-24',
        amountDue: 1500,
        allocations: [
          {
            amountApplied: 500,
            repayment: {
              status: RepaymentStatus.APPROVED,
              operationType: RepaymentOperationType.PAYMENT,
            },
          },
        ],
      },
    ]);

    const result = await service.getCenterMembers('center-1', '2026-10-24');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      weeklyPaid: false,
      weeklyHasAllocation: true,
      weeklyAmountDue: 1500,
      weeklyAmountApplied: 500,
    });
  });

  it('recognizes advance-funded next-week allocations but ignores pending and reversal rows', async () => {
    const member = { id: 'member-1', center: { id: 'center-1' } } as Member;
    const loan = {
      id: 'loan-1',
      borrower: member,
      status: 'active',
      termWeeks: 1,
    } as Loan;
    memberRepository.find.mockResolvedValue([member]);
    loanRepository.createQueryBuilder.mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([loan]),
    });
    scheduleFind.mockResolvedValue([
      {
        loanId: loan.id,
        weekNumber: 1,
        dueDate: '2026-10-24',
        amountDue: 1500,
        allocations: [
          {
            amountApplied: 1500,
            repayment: {
              status: RepaymentStatus.APPROVED,
              operationType: RepaymentOperationType.PAYMENT,
              paymentDate: '2026-10-17',
            },
          },
          {
            amountApplied: 500,
            repayment: {
              status: RepaymentStatus.PENDING,
              operationType: RepaymentOperationType.PAYMENT,
            },
          },
          {
            amountApplied: 500,
            repayment: {
              status: RepaymentStatus.APPROVED,
              operationType: RepaymentOperationType.REVERSAL,
            },
          },
        ],
      },
    ]);

    const result = await service.getCenterMembers('center-1', '2026-10-24');

    expect(result).toHaveLength(1);
    expect(result[0].weeklyPaid).toBe(true);
    expect(result[0].weeklyAmountDue).toBe(1500);
    expect(result[0].weeklyAmountApplied).toBe(1500);
  });

  it.each([
    ['legacy', null, null],
    ['policy enrolled', 'DCLA_2026_V1', '2026-07-14'],
  ])(
    'classifies a complete %s active loan after maturity without changing population',
    async (_label, policyVersion, policyEffectiveDate) => {
      const member = { id: 'member-1', center: { id: 'center-1' } } as Member;
      const loan = {
        id: 'loan-1',
        borrower: member,
        status: 'active',
        termWeeks: 12,
        overdueChargePolicyVersion: policyVersion,
        overdueChargePolicyEffectiveDate: policyEffectiveDate,
      } as Loan;
      memberRepository.find.mockResolvedValue([member]);
      loanRepository.createQueryBuilder.mockReturnValue({
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([loan]),
      });
      scheduleFind.mockResolvedValue(
        scheduleSeries(
          loan.id,
          '2026-07-21',
          Array.from({ length: 12 }, () => 1090),
        ),
      );

      const result = await service.getCenterMembers('center-1', '2026-10-20');

      expect(result.map(({ id }) => id)).toEqual([member.id]);
      expect(result[0]).toMatchObject({
        weeklyPaid: null,
        weeklyFinancial: {
          kind: 'post_maturity_no_weekly_obligation',
          amountDue: null,
          amountApplied: null,
          postMaturityLoanCount: 1,
          incompleteScheduleLoanCount: 0,
        },
      });
    },
  );

  it('marks an incomplete contractual schedule as unexpectedly missing', async () => {
    const member = { id: 'member-1', center: { id: 'center-1' } } as Member;
    const loan = {
      id: 'loan-1',
      borrower: member,
      status: 'active',
      termWeeks: 3,
    } as Loan;
    memberRepository.find.mockResolvedValue([member]);
    loanRepository.createQueryBuilder.mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([loan]),
    });
    scheduleFind.mockResolvedValue(
      scheduleSeries(loan.id, '2026-10-10', [1500, 1500]),
    );

    const result = await service.getCenterMembers('center-1', '2026-10-20');

    expect(result).toHaveLength(1);
    expect(result[0].weeklyFinancial).toEqual({
      kind: 'missing_schedule_unexpectedly',
      amountDue: null,
      amountApplied: null,
      postMaturityLoanCount: 0,
      incompleteScheduleLoanCount: 1,
    });
  });

  it('marks malformed contractual schedule coverage as unexpectedly missing', async () => {
    const member = { id: 'member-1', center: { id: 'center-1' } } as Member;
    const loan = {
      id: 'loan-1',
      borrower: member,
      status: 'active',
      termWeeks: 2,
    } as Loan;
    memberRepository.find.mockResolvedValue([member]);
    loanRepository.createQueryBuilder.mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([loan]),
    });
    scheduleFind.mockResolvedValue([
      {
        loanId: loan.id,
        weekNumber: 1,
        dueDate: '2026-10-10',
        amountDue: 1500,
        allocations: [],
      },
      {
        loanId: loan.id,
        weekNumber: 2,
        dueDate: '2026-10-24',
        amountDue: 1500,
        allocations: [],
      },
    ]);

    const result = await service.getCenterMembers('center-1', '2026-10-20');

    expect(result[0].weeklyFinancial).toMatchObject({
      kind: 'missing_schedule_unexpectedly',
      incompleteScheduleLoanCount: 1,
    });
  });

  it('classifies a complete persisted schedule before its first due as no obligation', async () => {
    const result = await projectLoanCondition({
      selectedDate: '2026-10-15',
      schedules: scheduleSeries(
        'loan-1',
        '2026-10-18',
        Array.from({ length: 8 }, () => 1500),
      ),
    });

    expect(result.weeklyFinancial).toEqual({
      kind: 'pre_first_due_no_weekly_obligation',
      amountDue: null,
      amountApplied: null,
      postMaturityLoanCount: 0,
      incompleteScheduleLoanCount: 0,
    });
  });

  it('projects Evelyn from a zero-payment legacy synthetic schedule', async () => {
    const result = await projectLoanCondition({
      selectedDate: '2026-10-20',
      schedules: [],
      loanOverrides: {
        termWeeks: 24,
        principalAmount: 17330,
        totalAmount: 27728,
        weeklyPaymentAmount: 1160,
        loanCreatedDate: new Date('2026-09-01T00:00:00.000Z'),
      },
    });

    expect(result).toMatchObject({
      weeklyPaid: false,
      weeklyHasAllocation: false,
      weeklyFinancial: {
        kind: 'scheduled_week',
        amountDue: 1160,
        amountApplied: 0,
        postMaturityLoanCount: 0,
        incompleteScheduleLoanCount: 0,
      },
    });
  });

  it('includes a deterministically linked savings debit in synthetic funding', async () => {
    savingsFind.mockResolvedValue([
      {
        id: 'savings-debit-1',
        eventType: 'repayment_debit',
        referenceId: 'payment-1',
        idempotencyKey: 'repayment:v1:payment-1:savings-debit',
        amount: -600,
      },
    ]);
    const result = await projectLoanCondition({
      selectedDate: '2026-09-09',
      schedules: [],
      repayments: [
        {
          id: 'payment-1',
          amount: 400,
          useSavings: true,
          status: RepaymentStatus.APPROVED,
          operationType: RepaymentOperationType.PAYMENT,
          paymentDate: '2026-09-08',
        },
      ],
      loanOverrides: {
        termWeeks: 2,
        totalAmount: 2000,
        weeklyPaymentAmount: 1000,
        loanCreatedDate: new Date('2026-09-01T00:00:00.000Z'),
      },
    });

    expect(result.weeklyFinancial).toMatchObject({
      kind: 'scheduled_week',
      amountDue: 1000,
      amountApplied: 1000,
      incompleteScheduleLoanCount: 0,
    });
    expect(savingsFind).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Armen', '2026-07-08', 'Sunday', 8, 540, 4320],
    ['Alejandra', '2026-07-13', 'Monday', 12, 760, 9100],
  ])(
    'projects post-maturity legacy zero-payment plan for %s',
    async (_name, releaseDate, collectionDay, termWeeks, weekly, total) => {
      const member = {
        id: 'member-1',
        center: { id: 'center-1', collectionDay },
      } as Member;
      memberRepository.find.mockResolvedValue([member]);
      const loan = {
        id: 'loan-1',
        borrower: member,
        status: 'active',
        principalAmount: total,
        totalAmount: total,
        balance: total,
        weeklyPaymentAmount: weekly,
        termWeeks,
        overdueChargePolicyVersion: null,
        overdueChargePolicyEffectiveDate: null,
        loanCreatedDate: new Date(`${releaseDate}T00:00:00.000Z`),
      } as Loan;
      loanRepository.createQueryBuilder.mockReturnValue({
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([loan]),
      });
      loanRepository.query.mockResolvedValue([
        { loanId: loan.id, releaseDate },
      ]);

      const [result] = await service.getCenterMembers('center-1', '2026-10-20');

      expect(result.weeklyFinancial).toEqual({
        kind: 'post_maturity_no_weekly_obligation',
        amountDue: null,
        amountApplied: null,
        postMaturityLoanCount: 1,
        incompleteScheduleLoanCount: 0,
      });
    },
  );

  it.each([
    ['partial', 400, '2026-09-09', 400],
    ['advance', 2000, '2026-09-16', 1000],
    ['future payment', 1000, '2026-09-16', 0, '2026-09-17'],
  ])(
    'replays a synthetic %s payment oldest-first',
    async (
      _label,
      amount,
      selectedDate,
      expectedApplied,
      paymentDate = '2026-09-08',
    ) => {
      const result = await projectLoanCondition({
        selectedDate,
        schedules: [],
        repayments: [
          {
            id: 'payment-1',
            amount,
            useSavings: false,
            status: RepaymentStatus.APPROVED,
            operationType: RepaymentOperationType.PAYMENT,
            paymentDate,
            createdAt: new Date(`${paymentDate}T00:00:00.000Z`),
          },
        ],
        loanOverrides: {
          termWeeks: 2,
          totalAmount: 2000,
          weeklyPaymentAmount: 1000,
          loanCreatedDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      });

      expect(result.weeklyFinancial).toMatchObject({
        kind: 'scheduled_week',
        amountDue: 1000,
        amountApplied: expectedApplied,
        incompleteScheduleLoanCount: 0,
      });
    },
  );

  it.each([
    ['before', '2026-09-14', 0],
    ['after', '2026-09-20', 1000],
  ])(
    'applies an approved reversal %s the selected date correctly',
    async (_label, reversalDate, expectedApplied) => {
      const result = await projectLoanCondition({
        selectedDate: '2026-09-16',
        schedules: [],
        repayments: [
          {
            id: 'payment-1',
            amount: 2000,
            useSavings: false,
            status: RepaymentStatus.APPROVED,
            operationType: RepaymentOperationType.PAYMENT,
            paymentDate: '2026-09-08',
          },
          {
            id: 'reversal-1',
            amount: 2000,
            useSavings: false,
            status: RepaymentStatus.APPROVED,
            operationType: RepaymentOperationType.REVERSAL,
            relatedRepaymentId: 'payment-1',
            paymentDate: reversalDate,
          },
        ],
        loanOverrides: {
          termWeeks: 2,
          totalAmount: 2000,
          weeklyPaymentAmount: 1000,
          loanCreatedDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      });

      expect(result.weeklyFinancial).toMatchObject({
        kind: 'scheduled_week',
        amountApplied: expectedApplied,
        incompleteScheduleLoanCount: 0,
      });
    },
  );

  it.each([
    [
      'missing business date',
      {
        id: 'payment-1',
        amount: 400,
        useSavings: false,
        status: RepaymentStatus.APPROVED,
        operationType: RepaymentOperationType.PAYMENT,
      },
    ],
    [
      'unknown savings component',
      {
        id: 'payment-1',
        amount: 400,
        useSavings: true,
        status: RepaymentStatus.APPROVED,
        operationType: RepaymentOperationType.PAYMENT,
        paymentDate: '2026-09-08',
      },
    ],
  ])('separates %s from schedule integrity', async (_label, repayment) => {
    const result = await projectLoanCondition({
      selectedDate: '2026-09-09',
      schedules: [],
      repayments: [repayment],
      loanOverrides: {
        termWeeks: 2,
        totalAmount: 2000,
        weeklyPaymentAmount: 1000,
        loanCreatedDate: new Date('2026-09-01T00:00:00.000Z'),
      },
    });

    expect(result.weeklyFinancial).toEqual({
      kind: 'historical_funding_unavailable',
      amountDue: null,
      amountApplied: null,
      postMaturityLoanCount: 0,
      incompleteScheduleLoanCount: 0,
    });
  });

  it('keeps zero schedules on a policy-enrolled loan as a genuine issue', async () => {
    const result = await projectLoanCondition({
      selectedDate: '2026-09-09',
      schedules: [],
      loanOverrides: {
        termWeeks: 2,
        totalAmount: 2000,
        weeklyPaymentAmount: 1000,
        loanCreatedDate: new Date('2026-09-01T00:00:00.000Z'),
        overdueChargePolicyVersion: 'DCLA_2026_V1',
        overdueChargePolicyEffectiveDate: '2026-09-01',
      },
    });

    expect(result.weeklyFinancial).toMatchObject({
      kind: 'missing_schedule_unexpectedly',
      incompleteScheduleLoanCount: 1,
    });
  });

  it('keeps a current-week underfunded schedule normal while weekly status remains unpaid', async () => {
    const result = await projectLoanCondition({
      selectedDate: '2026-10-15',
      schedules: scheduleSeries('loan-1', '2026-10-13', [1500, 1500]),
    });

    expect(result.weeklyPaid).toBe(false);
    expect(result.loanCondition).toEqual({ status: 'normal' });
  });

  it('marks previous-week partial or unpaid schedules past due', async () => {
    const schedules = scheduleSeries(
      'loan-1',
      '2026-10-06',
      [1500, 1500, 1500],
    );
    schedules[0].allocations = [approvedAllocation(500, '2026-10-06')];

    const result = await projectLoanCondition({
      selectedDate: '2026-10-15',
      schedules,
    });

    expect(result.loanCondition).toEqual({ status: 'past_due' });
  });

  it('uses the exact final-due boundary and gives maturity precedence', async () => {
    const schedules = scheduleSeries('loan-1', '2026-10-06', [1500]);
    const onFinalDue = await projectLoanCondition({
      selectedDate: '2026-10-06',
      schedules,
    });
    const afterFinalDue = await projectLoanCondition({
      selectedDate: '2026-10-07',
      schedules,
    });

    expect(onFinalDue.loanCondition).toEqual({ status: 'normal' });
    expect(afterFinalDue.loanCondition).toEqual({ status: 'past_maturity' });
  });

  it('does not report past due when effective advance allocations fully fund old schedules', async () => {
    const schedules = scheduleSeries(
      'loan-1',
      '2026-10-06',
      [1500, 1500, 1500],
    );
    schedules[0].allocations = [approvedAllocation(1500, '2026-10-01')];
    schedules[1].allocations = [approvedAllocation(1500, '2026-10-01')];

    const result = await projectLoanCondition({
      selectedDate: '2026-10-15',
      schedules,
    });

    expect(result.loanCondition).toEqual({ status: 'normal' });
  });

  it('excludes payments made after the selected historical date', async () => {
    const schedules = scheduleSeries(
      'loan-1',
      '2026-10-06',
      [1500, 1500, 1500],
    );
    schedules[0].allocations = [approvedAllocation(1500, '2026-10-16')];

    const result = await projectLoanCondition({
      selectedDate: '2026-10-15',
      schedules,
    });

    expect(result.loanCondition).toEqual({ status: 'past_due' });
  });

  it('marks a pre-reversal historical view indeterminate', async () => {
    const result = await projectLoanCondition({
      selectedDate: '2026-10-15',
      schedules: scheduleSeries('loan-1', '2026-10-06', [1500, 1500]),
      repayments: [
        {
          id: 'payment-1',
          status: RepaymentStatus.APPROVED,
          operationType: RepaymentOperationType.PAYMENT,
          paymentDate: '2026-10-06',
        },
        {
          id: 'reversal-1',
          status: RepaymentStatus.APPROVED,
          operationType: RepaymentOperationType.REVERSAL,
          relatedRepaymentId: 'payment-1',
          paymentDate: '2026-10-16',
        },
      ],
    });

    expect(result.loanCondition).toEqual({ status: 'indeterminate' });
  });

  it('uses current reversed allocation truth once the reversal is effective', async () => {
    const result = await projectLoanCondition({
      selectedDate: '2026-10-17',
      schedules: scheduleSeries('loan-1', '2026-10-06', [1500, 1500, 1500]),
      repayments: [
        {
          id: 'payment-1',
          status: RepaymentStatus.APPROVED,
          operationType: RepaymentOperationType.PAYMENT,
          paymentDate: '2026-10-06',
        },
        {
          id: 'reversal-1',
          status: RepaymentStatus.APPROVED,
          operationType: RepaymentOperationType.REVERSAL,
          relatedRepaymentId: 'payment-1',
          paymentDate: '2026-10-16',
        },
      ],
    });

    expect(result.loanCondition).toEqual({ status: 'past_due' });
  });

  it('reconstructs a valid legacy zero-schedule timeline without persisting rows', async () => {
    const result = await projectLoanCondition({
      selectedDate: '2026-09-16',
      schedules: [],
      loanOverrides: {
        termWeeks: 2,
        loanCreatedDate: new Date('2026-09-01T00:00:00.000Z'),
      },
    });

    expect(result.loanCondition).toEqual({ status: 'past_maturity' });
    expect(scheduleFind).toHaveBeenCalledTimes(1);
  });

  it('marks invalid legacy reconstruction and malformed persisted schedules indeterminate', async () => {
    const invalidLegacy = await projectLoanCondition({
      selectedDate: '2026-10-15',
      schedules: [],
      loanOverrides: { termWeeks: 2, loanCreatedDate: undefined },
    });
    const malformed = scheduleSeries('loan-1', '2026-10-06', [1500, 1500]);
    malformed[1].dueDate = '2026-10-20';
    const invalidPersisted = await projectLoanCondition({
      selectedDate: '2026-10-15',
      schedules: malformed,
    });

    expect(invalidLegacy.loanCondition).toEqual({ status: 'indeterminate' });
    expect(invalidPersisted.loanCondition).toEqual({ status: 'indeterminate' });
  });

  it('aggregates multiple active-loan conditions by severity', () => {
    expect(
      aggregateLoanConditions([{ status: 'normal' }, { status: 'past_due' }]),
    ).toEqual({ status: 'past_due' });
    expect(
      aggregateLoanConditions([
        { status: 'past_due' },
        { status: 'past_maturity' },
      ]),
    ).toEqual({ status: 'past_maturity' });
    expect(
      aggregateLoanConditions([
        { status: 'normal' },
        { status: 'indeterminate' },
      ]),
    ).toEqual({ status: 'indeterminate' });
    expect(
      aggregateLoanConditions([
        { status: 'past_due' },
        { status: 'indeterminate' },
      ]),
    ).toEqual({ status: 'past_due' });
  });

  it('filters before paging and uses the member id as a stable tie-breaker', async () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    memberRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    await service.findAll({
      page: 2,
      limit: 10,
      search: 'del',
      centerId: 'c1',
    });

    expect(queryBuilder.andWhere.mock.invocationCallOrder[0]).toBeLessThan(
      queryBuilder.skip.mock.invocationCallOrder[0],
    );
    expect(queryBuilder.addOrderBy).toHaveBeenLastCalledWith(
      'member.id',
      'ASC',
    );
    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
    expect(queryBuilder.take).toHaveBeenCalledWith(10);
  });
});
