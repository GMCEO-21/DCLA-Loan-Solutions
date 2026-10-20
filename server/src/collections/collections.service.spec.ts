import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CollectionsService } from './collections.service';
import { Collection } from './entities/collection.entity';
import { Center } from '../centers/entities/center.entity';
import { Member } from '../members/entities/member.entity';
import { Repayment, RepaymentStatus } from '../repayments/repayment.entity';
import { CollectionsRepository } from './collections.repository';

describe('CollectionsService', () => {
  let service: CollectionsService;
  let collectionRepo: { find: jest.Mock };
  let centerRepo: { find: jest.Mock };
  let memberRepo: { createQueryBuilder: jest.Mock };
  let repaymentRepo: { query: jest.Mock };

  beforeEach(async () => {
    collectionRepo = { find: jest.fn() };
    centerRepo = { find: jest.fn() };
    memberRepo = { createQueryBuilder: jest.fn() };
    repaymentRepo = { query: jest.fn().mockResolvedValue([]) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionsService,
        { provide: getRepositoryToken(Collection), useValue: collectionRepo },
        { provide: getRepositoryToken(Center), useValue: centerRepo },
        { provide: getRepositoryToken(Member), useValue: memberRepo },
        { provide: getRepositoryToken(Repayment), useValue: repaymentRepo },
        { provide: CollectionsRepository, useValue: {} },
      ],
    }).compile();

    service = module.get<CollectionsService>(CollectionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it.each([
    ['2026-09-07', 'Monday'],
    ['2026-09-08', 'Tuesday'],
  ])('uses the host-independent weekday for %s', async (date, weekday) => {
    centerRepo.find.mockResolvedValue([]);

    await service.getTodayCollections(date);

    expect(centerRepo.find).toHaveBeenCalledWith({
      where: { collectionDay: weekday },
    });
  });

  it.each(['2026-02-29', '2026-09-31', '2026-13-01', 'invalid'])(
    'rejects invalid collection date %s with a standard bad request',
    async (date) => {
      await expect(service.getTodayCollections(date)).rejects.toThrow(
        'Invalid collection date. Expected a valid YYYY-MM-DD date.',
      );
      expect(centerRepo.find).not.toHaveBeenCalled();
    },
  );

  it('queries Daily collections with the exact supplied database date', async () => {
    const memberQuery = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    centerRepo.find.mockResolvedValue([
      { id: 'center-1', name: 'Alpha', collectionDay: 'Monday' },
    ]);
    let capturedFindOptions: unknown;
    collectionRepo.find.mockImplementation((options: unknown) => {
      capturedFindOptions = options;
      return Promise.resolve([]);
    });
    memberRepo.createQueryBuilder.mockReturnValue(memberQuery);

    const groups = await service.getTodayCollections('2026-09-07');

    const findOptions = capturedFindOptions as {
      where: { collectionDate: string };
      relations: string[];
    };
    expect(findOptions.where.collectionDate).toBe('2026-09-07');
    expect(findOptions.relations).toEqual(['member']);
    expect(groups).toEqual([
      expect.objectContaining({
        collectionDate: '2026-09-07',
        collectionDay: 'Monday',
      }),
    ]);
  });

  it('builds dated groups with four fixed queries and count projections', async () => {
    const memberQuery = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValue([{ centerId: 'center-1', count: '3' }]),
    };
    centerRepo.find.mockResolvedValue([
      { id: 'center-1', name: 'Alpha', collectionDay: 'Friday' },
    ]);
    collectionRepo.find.mockResolvedValue([
      {
        id: 'collection-1',
        centerId: 'center-1',
        memberId: 'member-1',
        collectionDate: '2026-09-04',
        amount: 200,
      },
    ]);
    memberRepo.createQueryBuilder.mockReturnValue(memberQuery);
    repaymentRepo.query.mockResolvedValue([
      {
        centerId: 'center-1',
        status: RepaymentStatus.APPROVED,
        cashAmount: '100',
        savingsAmount: '25',
        isReversed: false,
      },
    ]);

    const groups = await service.getAllCollectionsGrouped('2026-09-04');

    expect(centerRepo.find).toHaveBeenCalledTimes(1);
    expect(collectionRepo.find).toHaveBeenCalledTimes(1);
    expect(collectionRepo.find).toHaveBeenCalledWith({
      where: { collectionDate: '2026-09-04' },
      relations: ['member'],
      order: { collectionDate: 'ASC', createdAt: 'ASC' },
    });
    expect(memberQuery.getRawMany).toHaveBeenCalledTimes(1);
    expect(repaymentRepo.query).toHaveBeenCalledTimes(1);
    expect(groups).toEqual([
      expect.objectContaining({
        centerId: 'center-1',
        totalMembers: 3,
        pendingCollections: 2,
        totalAmount: 200,
        totalReceived: 125,
      }),
    ]);
  });

  it('uses repayment business dates and approved payment value for Daily totals', async () => {
    const memberQuery = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    centerRepo.find.mockResolvedValue([
      { id: 'center-1', name: 'Alpha', collectionDay: 'Tuesday' },
    ]);
    collectionRepo.find.mockResolvedValue([]);
    memberRepo.createQueryBuilder.mockReturnValue(memberQuery);
    repaymentRepo.query.mockResolvedValue([
      {
        centerId: 'center-1',
        status: RepaymentStatus.APPROVED,
        cashAmount: '800',
        savingsAmount: '200',
        isReversed: false,
      },
      {
        centerId: 'center-1',
        status: RepaymentStatus.APPROVED,
        cashAmount: '500',
        savingsAmount: '0',
        isReversed: false,
      },
      {
        centerId: 'center-1',
        status: RepaymentStatus.PENDING,
        cashAmount: '900',
        savingsAmount: '100',
        isReversed: false,
      },
      {
        centerId: 'center-1',
        status: RepaymentStatus.REJECTED,
        cashAmount: '700',
        savingsAmount: '0',
        isReversed: false,
      },
    ]);

    const [group] = await service.getTodayCollections('2026-10-20');

    expect(group.totalReceived).toBe(1500);
    const [sql, parameters] = repaymentRepo.query.mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).toContain(
      'COALESCE(payment."paymentDate", payment."collectionDate") = $2::date',
    );
    expect(sql).not.toContain('payment."createdAt"');
    expect(sql).not.toContain('payment."approvedAt"');
    expect(sql).toContain('loan_repayment_allocation');
    expect(sql).toContain('loan_charge_ledger');
    expect(parameters[1]).toBe('2026-10-20');
  });

  it('restates approved reversals on the original payment date', async () => {
    const memberQuery = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    centerRepo.find.mockResolvedValue([
      { id: 'center-1', name: 'Alpha', collectionDay: 'Sunday' },
    ]);
    collectionRepo.find.mockResolvedValue([]);
    memberRepo.createQueryBuilder.mockReturnValue(memberQuery);
    repaymentRepo.query.mockResolvedValue([
      {
        centerId: 'center-1',
        status: RepaymentStatus.APPROVED,
        cashAmount: '1000',
        savingsAmount: '0',
        isReversed: true,
      },
    ]);

    const [group] = await service.getTodayCollections('2026-10-18');

    expect(group.totalReceived).toBe(0);
    const [sql] = repaymentRepo.query.mock.calls[0] as [string];
    expect(sql).toContain('reversal."relatedRepaymentId" = payment.id');
    expect(sql).toContain('reversal.status = $5');
  });

  it('does not create a negative total on the reversal business date', async () => {
    const memberQuery = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    centerRepo.find.mockResolvedValue([
      { id: 'center-1', name: 'Alpha', collectionDay: 'Tuesday' },
    ]);
    collectionRepo.find.mockResolvedValue([]);
    memberRepo.createQueryBuilder.mockReturnValue(memberQuery);
    repaymentRepo.query.mockResolvedValue([]);

    const [group] = await service.getTodayCollections('2026-10-20');

    expect(group.totalReceived).toBe(0);
    const [sql] = repaymentRepo.query.mock.calls[0] as [string];
    expect(sql).toContain('payment."operationType" = $1');
  });
});
