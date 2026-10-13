import { Test, TestingModule } from '@nestjs/testing';
import { MembersService } from './members.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Between, DataSource, In } from 'typeorm';
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
  let loanRepository: { createQueryBuilder: jest.Mock };
  let scheduleFind: jest.Mock;

  beforeEach(async () => {
    scheduleFind = jest.fn().mockResolvedValue([]);
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
    loanRepository = { createQueryBuilder: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: getRepositoryToken(Member), useValue: memberRepository },
        { provide: getRepositoryToken(Center), useValue: {} },
        { provide: getRepositoryToken(Loan), useValue: loanRepository },
        { provide: getRepositoryToken(Repayment), useValue: {} },
        { provide: getRepositoryToken(Savings), useValue: {} },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
  });

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
    ['2026-10-17', '2026-10-17', '2026-10-23', true],
    ['2026-10-18', '2026-10-17', '2026-10-23', true],
    ['2026-10-19', '2026-10-17', '2026-10-23', true],
    ['2026-10-20', '2026-10-17', '2026-10-23', true],
    ['2026-10-21', '2026-10-17', '2026-10-23', true],
    ['2026-10-22', '2026-10-17', '2026-10-23', true],
    ['2026-10-23', '2026-10-17', '2026-10-23', true],
    ['2026-10-24', '2026-10-24', '2026-10-30', false],
  ])(
    'projects the selected week for %s without changing member population or amounts',
    async (selectedDate, weekStart, weekEnd, expectedPaid) => {
      const member = { id: 'member-1', center: { id: 'center-1' } } as Member;
      const loan = {
        id: 'loan-1',
        borrower: member,
        status: 'active',
        principalAmount: 3000,
        balance: 1500,
        totalAmount: 3500,
        weeklyPaymentAmount: 1500,
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
          amountDue: 1500,
          allocations: expectedPaid
            ? [
                {
                  amountApplied: 1500,
                  repayment: {
                    status: RepaymentStatus.APPROVED,
                    operationType: RepaymentOperationType.PAYMENT,
                  },
                },
              ]
            : [],
        },
      ]);

      const result = await service.getCenterMembers('center-1', selectedDate);

      expect(scheduleFind).toHaveBeenCalledWith({
        where: {
          loanId: In([loan.id]),
          dueDate: Between(weekStart, weekEnd),
        },
        relations: ['allocations', 'allocations.repayment'],
      });
      expect(result.map(({ id }) => id)).toEqual(['member-1']);
      expect(result[0]).toMatchObject({
        totalLoanAmount: 3000,
        totalBalance: 1500,
        weeklyPaid: expectedPaid,
        weeklyHasAllocation: expectedPaid,
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
  });

  it('recognizes advance-funded next-week allocations but ignores pending and reversal rows', async () => {
    const member = { id: 'member-1', center: { id: 'center-1' } } as Member;
    const loan = { id: 'loan-1', borrower: member, status: 'active' } as Loan;
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
