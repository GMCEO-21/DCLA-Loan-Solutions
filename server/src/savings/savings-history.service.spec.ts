import { NotFoundException } from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Member } from '../members/entities/member.entity';
import {
  SavingsHistoryQueryDto,
  SavingsHistoryScope,
} from './dto/savings-history-query.dto';
import { Savings, SavingsEventType } from './savings.entity';
import { SavingsHistoryService } from './savings-history.service';

interface QueryBuilderHarness {
  builder: SelectQueryBuilder<Savings>;
  where: jest.Mock;
  andWhere: jest.Mock;
  leftJoin: jest.Mock;
  select: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  offset: jest.Mock;
  limit: jest.Mock;
  getCount: jest.Mock;
  getRawMany: jest.Mock;
}

function queryBuilderHarness(
  options: { total?: number; rows?: Array<Record<string, unknown>> } = {},
): QueryBuilderHarness {
  const harness = {} as QueryBuilderHarness;
  const chain = () => jest.fn(() => harness.builder);
  harness.where = chain();
  harness.andWhere = chain();
  harness.leftJoin = chain();
  harness.select = chain();
  harness.orderBy = chain();
  harness.addOrderBy = chain();
  harness.offset = chain();
  harness.limit = chain();
  harness.getCount = jest.fn().mockResolvedValue(options.total ?? 0);
  harness.getRawMany = jest.fn().mockResolvedValue(options.rows ?? []);
  harness.builder = {
    where: harness.where,
    andWhere: harness.andWhere,
    leftJoin: harness.leftJoin,
    select: harness.select,
    orderBy: harness.orderBy,
    addOrderBy: harness.addOrderBy,
    offset: harness.offset,
    limit: harness.limit,
    getCount: harness.getCount,
    getRawMany: harness.getRawMany,
  } as unknown as SelectQueryBuilder<Savings>;
  return harness;
}

function createHarness(options: {
  memberExists?: boolean;
  total?: number;
  rows?: Array<Record<string, unknown>>;
}) {
  const count = queryBuilderHarness({ total: options.total });
  const page = queryBuilderHarness({ rows: options.rows });
  const createQueryBuilder = jest
    .fn()
    .mockReturnValueOnce(count.builder)
    .mockReturnValueOnce(page.builder);
  const findMember = jest
    .fn()
    .mockResolvedValue(options.memberExists === false ? null : { id: 'm1' });
  const savingsRepository = {
    createQueryBuilder,
  } as unknown as Repository<Savings>;
  const memberRepository = {
    findOne: findMember,
  } as unknown as Repository<Member>;

  return {
    service: new SavingsHistoryService(savingsRepository, memberRepository),
    savingsRepository,
    memberRepository,
    createQueryBuilder,
    findMember,
    count,
    page,
  };
}

const createdAt = new Date('2026-09-03T15:14:29.683Z');
const manilaCreatedAtProjection = `savings."createdAt" AT TIME ZONE 'Asia/Manila' AS "createdAt"`;

describe('SavingsHistoryService', () => {
  it('returns only complete ledger fields with safe actor provenance', async () => {
    const harness = createHarness({
      total: 3,
      rows: [
        {
          id: 'ledger-2',
          eventType: SavingsEventType.REPAYMENT_REVERSAL_CREDIT,
          amount: '125.5',
          balanceBefore: '874.50',
          balanceAfter: '1000.00',
          businessDate: '2026-09-03',
          createdAt,
          remarks: 'Reversed payment',
          loanId: 'loan-1',
          referenceType: 'repayment_reversal',
          referenceId: 'reversal-1',
          reversalOfId: 'ledger-1',
          performedById: 'actor-1',
          actorFirstName: 'Ana',
          actorMiddleName: null,
          actorLastName: 'Manager',
        },
        {
          id: 'ledger-1',
          eventType: SavingsEventType.MANUAL_DEPOSIT,
          amount: '100.00',
          balanceBefore: '900.00',
          balanceAfter: '1000.00',
          businessDate: '2026-09-02',
          createdAt,
          remarks: null,
          loanId: null,
          referenceType: null,
          referenceId: null,
          reversalOfId: null,
          performedById: null,
          actorFirstName: null,
          actorMiddleName: null,
          actorLastName: null,
        },
      ],
    });

    const result = await harness.service.findMemberHistory('m1', {
      scope: SavingsHistoryScope.LEDGER,
      page: 2,
      limit: 2,
    });

    expect(result).toEqual({
      scope: SavingsHistoryScope.LEDGER,
      items: [
        {
          recordClass: SavingsHistoryScope.LEDGER,
          id: 'ledger-2',
          eventType: SavingsEventType.REPAYMENT_REVERSAL_CREDIT,
          amount: '125.50',
          balanceBefore: '874.50',
          balanceAfter: '1000.00',
          businessDate: '2026-09-03',
          createdAt,
          remarks: 'Reversed payment',
          loanId: 'loan-1',
          performedBy: { id: 'actor-1', name: 'Ana Manager' },
          referenceType: 'repayment_reversal',
          referenceId: 'reversal-1',
          reversalOfId: 'ledger-1',
        },
        expect.objectContaining({
          id: 'ledger-1',
          performedBy: null,
        }),
      ],
      pagination: { page: 2, limit: 2, total: 3, totalPages: 2 },
    });
    expect(harness.count.andWhere).toHaveBeenCalledWith(
      'savings."eventType" IS NOT NULL',
    );
    expect(harness.page.leftJoin).toHaveBeenCalledWith(
      'savings.performedBy',
      'actor',
    );
    expect(harness.page.orderBy).toHaveBeenCalledWith(
      'savings.createdAt',
      'DESC',
    );
    expect(harness.page.addOrderBy).toHaveBeenCalledWith('savings.id', 'DESC');
    expect(harness.page.offset).toHaveBeenCalledWith(2);
    expect(harness.page.limit).toHaveBeenCalledWith(2);
    expect(harness.page.select).toHaveBeenCalledWith(
      expect.arrayContaining([manilaCreatedAtProjection]),
    );
    expect(harness.findMember).toHaveBeenCalledTimes(1);
    expect(harness.createQueryBuilder).toHaveBeenCalledTimes(2);
  });

  it('returns conservative legacy records classified only by amount sign', async () => {
    const harness = createHarness({
      total: 2,
      rows: [
        {
          id: 'legacy-negative',
          eventType: null,
          amount: '-300.00',
          createdAt,
          remarks: 'Old debit',
        },
        {
          id: 'legacy-positive',
          eventType: null,
          amount: '250',
          createdAt,
          remarks: null,
        },
      ],
    });

    const result = await harness.service.findMemberHistory('m1', {
      scope: SavingsHistoryScope.LEGACY,
    } as SavingsHistoryQueryDto);

    expect(result).toEqual({
      scope: SavingsHistoryScope.LEGACY,
      items: [
        {
          recordClass: SavingsHistoryScope.LEGACY,
          id: 'legacy-negative',
          amount: '-300.00',
          direction: 'debit',
          createdAt,
          remarks: 'Old debit',
        },
        {
          recordClass: SavingsHistoryScope.LEGACY,
          id: 'legacy-positive',
          amount: '250.00',
          direction: 'credit',
          createdAt,
          remarks: null,
        },
      ],
      pagination: { page: 1, limit: 25, total: 2, totalPages: 1 },
    });
    expect(harness.count.andWhere).toHaveBeenCalledWith(
      'savings."eventType" IS NULL',
    );
    expect(harness.page.leftJoin).not.toHaveBeenCalled();
    expect(harness.page.select).toHaveBeenCalledWith([
      'savings.id AS "id"',
      'savings.amount AS "amount"',
      manilaCreatedAtProjection,
      'savings.remarks AS "remarks"',
    ]);
    expect(result.items[0]?.createdAt.toISOString()).toBe(
      '2026-09-03T15:14:29.683Z',
    );
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

  it('returns an empty page for an existing member without matching rows', async () => {
    const harness = createHarness({ total: 0, rows: [] });

    await expect(
      harness.service.findMemberHistory('m1', {
        scope: SavingsHistoryScope.LEDGER,
      } as SavingsHistoryQueryDto),
    ).resolves.toEqual({
      scope: SavingsHistoryScope.LEDGER,
      items: [],
      pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
    });
  });

  it('returns 404 for a nonexistent member without querying history', async () => {
    const harness = createHarness({ memberExists: false });

    await expect(
      harness.service.findMemberHistory('missing', {
        scope: SavingsHistoryScope.LEDGER,
      } as SavingsHistoryQueryDto),
    ).rejects.toThrow(NotFoundException);
    expect(harness.createQueryBuilder).not.toHaveBeenCalled();
  });
});
