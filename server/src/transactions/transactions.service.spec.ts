import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Repository } from 'typeorm';
import { Repayment } from '../repayments/repayment.entity';
import { Savings } from '../savings/savings.entity';
import { TransactionsQueryDto } from './dto/transactions-query.dto';
import {
  TransactionHistoryItem,
  TransactionsService,
} from './transactions.service';

const item = (
  id: string,
  createdAt: string,
  source: 'repayment' | 'savings',
): TransactionHistoryItem => ({
  id,
  type: source === 'repayment' ? 'repayment' : 'savings_deposit',
  amount: 100,
  direction: 'credit',
  member: { id: 'member-1', name: 'Member, Test' },
  loan: { id: 'loan-1', status: 'active' },
  createdAt,
  source,
  canReverse: source === 'repayment',
});

function createQueryBuilder(rows: unknown[], total: number) {
  const countQuery = { getCount: jest.fn().mockResolvedValue(total) };
  const builder = {
    leftJoin: jest.fn(),
    andWhere: jest.fn(),
    clone: jest.fn(() => countQuery),
    select: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    limit: jest.fn(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };
  for (const method of [
    builder.leftJoin,
    builder.andWhere,
    builder.select,
    builder.orderBy,
    builder.addOrderBy,
    builder.limit,
  ]) {
    method.mockReturnValue(builder);
  }
  return { builder, countQuery };
}

describe('TransactionsService', () => {
  it('merges bounded source results with exact totals and deterministic paging', async () => {
    const service = new TransactionsService(
      {} as Repository<Repayment>,
      {} as Repository<Savings>,
    );
    const fetchRepayments = jest.fn().mockResolvedValue({
      items: [
        item('r3', '2026-09-05T03:00:00.000Z', 'repayment'),
        item('r1', '2026-09-05T01:00:00.000Z', 'repayment'),
      ],
      total: 5,
    });
    const fetchSavings = jest.fn().mockResolvedValue({
      items: [
        item('s4', '2026-09-05T04:00:00.000Z', 'savings'),
        item('s2', '2026-09-05T02:00:00.000Z', 'savings'),
      ],
      total: 3,
    });
    Object.assign(service, { fetchRepayments, fetchSavings });

    const result = await service.getHistory({
      page: 2,
      limit: 2,
      type: 'all',
    } as TransactionsQueryDto);

    expect(result.items.map(({ id }) => id)).toEqual(['s2', 'r1']);
    expect(result).toMatchObject({
      total: 8,
      page: 2,
      limit: 2,
      totalPages: 4,
    });
    expect(fetchRepayments).toHaveBeenCalledWith(
      expect.objectContaining({ fetchLimit: 4, include: true }),
    );
    expect(fetchSavings).toHaveBeenCalledWith(
      expect.objectContaining({ fetchLimit: 4, include: true }),
    );
  });

  it('uses a projected, ordered, bounded repayment query and an exact count', async () => {
    const row = {
      id: 'repayment-1',
      amount: '125.50',
      notes: null,
      collectionDate: '2026-09-05',
      paymentDate: '2026-09-05',
      operationType: 'payment',
      canReverse: true,
      createdAt: new Date('2026-09-03T15:14:29.683Z'),
      memberId: 'member-1',
      memberFirstName: 'Test',
      memberLastName: 'Member',
      memberCenterId: 'center-1',
      memberCenterName: 'Center One',
      repaymentCenterId: null,
      repaymentCenterName: null,
      loanId: 'loan-1',
      loanStatus: 'active',
    };
    const repayment = createQueryBuilder([row], 5);
    const repaymentRepo = {
      createQueryBuilder: jest.fn(() => repayment.builder),
    } as unknown as Repository<Repayment>;
    const createSavingsQueryBuilder = jest.fn();
    const savingsRepo = {
      createQueryBuilder: createSavingsQueryBuilder,
    } as unknown as Repository<Savings>;
    const service = new TransactionsService(repaymentRepo, savingsRepo);

    const result = await service.getHistory({
      type: 'repayment',
      page: 1,
      limit: 2,
      search: 'Member%_',
    } as TransactionsQueryDto);

    expect(result.items[0]).toMatchObject({
      id: 'repayment-1',
      amount: 125.5,
      createdAt: '2026-09-03T15:14:29.683Z',
      collectionDate: '2026-09-05',
      canReverse: true,
      member: {
        id: 'member-1',
        name: 'Member, Test',
        center: { id: 'center-1', name: 'Center One' },
      },
    });
    expect(repayment.builder.limit).toHaveBeenCalledWith(2);
    expect(repayment.builder.orderBy).toHaveBeenCalledWith(
      'repayment.createdAt',
      'DESC',
    );
    expect(repayment.builder.addOrderBy).toHaveBeenCalledWith(
      'repayment.id',
      'DESC',
    );
    expect(repayment.builder.getRawMany).toHaveBeenCalledTimes(1);
    expect(repayment.builder.select).toHaveBeenCalledWith(
      expect.arrayContaining([
        'repayment."collectionDate"::text AS "collectionDate"',
        'repayment."paymentDate"::text AS "paymentDate"',
        `repayment."createdAt" AT TIME ZONE 'Asia/Manila' AS "createdAt"`,
      ]),
    );
    expect(repayment.builder.select).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.stringMatching(
          /repayment\."operationType" = 'payment'[\s\S]*NOT EXISTS[\s\S]*"blockingReversal"\."relatedRepaymentId" = repayment\.id[\s\S]*"blockingReversal"\."operationType" = 'reversal'[\s\S]*"blockingReversal"\."status" IN \('pending', 'approved'\)[\s\S]*AS "canReverse"/,
        ),
      ]),
    );
    expect(repayment.builder.select).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('rejected')]),
    );
    expect(repayment.countQuery.getCount).toHaveBeenCalledTimes(1);
    expect(repayment.builder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('LOWER(CONCAT'),
      { search: '%member\\%\\_%' },
    );
    expect(createSavingsQueryBuilder).not.toHaveBeenCalled();
  });

  it('returns date-only collection dates for payments, reversals, and payment-date fallback', async () => {
    const baseRow = {
      amount: '125.50',
      notes: null,
      createdAt: new Date('2026-09-03T15:14:29.683Z'),
      memberId: 'member-1',
      memberFirstName: 'Test',
      memberLastName: 'Member',
      memberCenterId: 'center-1',
      memberCenterName: 'Center One',
      repaymentCenterId: null,
      repaymentCenterName: null,
      loanId: 'loan-1',
      loanStatus: 'active',
    };
    const repayment = createQueryBuilder(
      [
        {
          ...baseRow,
          id: 'payment-1',
          collectionDate: '2026-09-05',
          paymentDate: '2026-09-05',
          operationType: 'payment',
          canReverse: true,
        },
        {
          ...baseRow,
          id: 'reversal-1',
          collectionDate: '2026-09-05',
          paymentDate: '2026-09-05',
          operationType: 'reversal',
          canReverse: true,
        },
        {
          ...baseRow,
          id: 'fallback-1',
          collectionDate: null,
          paymentDate: '2026-09-06',
          operationType: 'payment',
          canReverse: false,
        },
      ],
      3,
    );
    const service = new TransactionsService(
      {
        createQueryBuilder: jest.fn(() => repayment.builder),
      } as unknown as Repository<Repayment>,
      {} as Repository<Savings>,
    );

    const result = await service.getHistory({
      type: 'repayment',
      page: 1,
      limit: 10,
    } as TransactionsQueryDto);

    expect(result.items.find(({ id }) => id === 'payment-1')).toMatchObject({
      collectionDate: '2026-09-05',
      repaymentOperationType: 'payment',
      canReverse: true,
    });
    expect(result.items.find(({ id }) => id === 'reversal-1')).toMatchObject({
      collectionDate: '2026-09-05',
      repaymentOperationType: 'reversal',
      canReverse: false,
    });
    expect(result.items.find(({ id }) => id === 'fallback-1')).toMatchObject({
      collectionDate: '2026-09-06',
      repaymentOperationType: 'payment',
      canReverse: false,
    });
    for (const transaction of result.items) {
      expect(transaction.collectionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(transaction.collectionDate).not.toContain('T');
    }
  });

  it('marks savings deposits and withdrawals as ineligible for reversal', async () => {
    const savings = createQueryBuilder(
      [
        {
          id: 'deposit-1',
          amount: '500.00',
          remarks: 'Deposit',
          createdAt: new Date('2026-09-03T15:14:29.683Z'),
          memberId: 'member-1',
          memberFirstName: 'Test',
          memberLastName: 'Member',
          centerId: 'center-1',
          centerName: 'Center One',
          loanId: null,
          loanStatus: null,
        },
        {
          id: 'withdrawal-1',
          amount: '-250.00',
          remarks: 'Withdrawal',
          createdAt: new Date('2026-09-03T15:15:29.683Z'),
          memberId: 'member-1',
          memberFirstName: 'Test',
          memberLastName: 'Member',
          centerId: 'center-1',
          centerName: 'Center One',
          loanId: null,
          loanStatus: null,
        },
      ],
      2,
    );
    const service = new TransactionsService(
      {} as Repository<Repayment>,
      {
        createQueryBuilder: jest.fn(() => savings.builder),
      } as unknown as Repository<Savings>,
    );

    const result = await service.getHistory({
      type: 'savings',
      page: 1,
      limit: 10,
    } as TransactionsQueryDto);

    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'deposit-1',
          type: 'savings_deposit',
          canReverse: false,
        }),
        expect.objectContaining({
          id: 'withdrawal-1',
          type: 'savings_withdrawal',
          canReverse: false,
        }),
      ]),
    );
  });

  it('rejects page sizes above the UI and API maximum', async () => {
    const dto = plainToInstance(TransactionsQueryDto, { page: 1, limit: 101 });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });
});
