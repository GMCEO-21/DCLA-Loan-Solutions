import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Repayment,
  RepaymentOperationType,
  RepaymentStatus,
} from '../repayments/repayment.entity';
import { Savings } from '../savings/savings.entity';
import { TransactionsQueryDto } from './dto/transactions-query.dto';

export type TransactionType =
  | 'repayment'
  | 'savings_deposit'
  | 'savings_withdrawal';

export interface TransactionHistoryItem {
  id: string;
  type: TransactionType;
  amount: number;
  direction: 'credit' | 'debit';
  member: {
    id: string | null;
    name: string;
    center?: {
      id: string | null;
      name: string | null;
    };
  };
  loan?: {
    id: string | null;
    status?: string | null;
  };
  notes?: string | null;
  createdAt: string;
  collectionDate?: string | null;
  source: 'repayment' | 'savings';
  repaymentOperationType?: 'payment' | 'reversal' | null;
  canReverse: boolean;
}

interface TransactionSourceResult {
  items: TransactionHistoryItem[];
  total: number;
}

interface RepaymentHistoryRow {
  id: string;
  amount: string | number;
  notes: string | null;
  collectionDate: string | null;
  paymentDate: string | null;
  operationType: RepaymentOperationType;
  canReverse: boolean;
  createdAt: Date | string;
  memberId: string | null;
  memberFirstName: string | null;
  memberLastName: string | null;
  memberCenterId: string | null;
  memberCenterName: string | null;
  repaymentCenterId: string | null;
  repaymentCenterName: string | null;
  loanId: string | null;
  loanStatus: string | null;
}

interface SavingsHistoryRow {
  id: string;
  amount: string | number;
  remarks: string | null;
  createdAt: Date | string;
  memberId: string | null;
  memberFirstName: string | null;
  memberLastName: string | null;
  centerId: string | null;
  centerName: string | null;
  loanId: string | null;
  loanStatus: string | null;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Repayment)
    private readonly repaymentRepo: Repository<Repayment>,
    @InjectRepository(Savings)
    private readonly savingsRepo: Repository<Savings>,
  ) {}

  async getHistory(query: TransactionsQueryDto) {
    const {
      memberId,
      centerId,
      loanId,
      type = 'all',
      search,
      startDate,
      endDate,
      page = 1,
      limit = 25,
    } = query;

    const [repayments, savingsEntries] = await Promise.all([
      this.fetchRepayments({
        memberId,
        centerId,
        loanId,
        startDate,
        endDate,
        search,
        fetchLimit: Math.min(page * limit, 2_147_483_647),
        include: type === 'all' || type === 'repayment',
      }),
      this.fetchSavings({
        memberId,
        centerId,
        loanId,
        startDate,
        endDate,
        search,
        fetchLimit: Math.min(page * limit, 2_147_483_647),
        include:
          type === 'all' ||
          type === 'savings' ||
          type === 'savings_deposit' ||
          type === 'savings_withdrawal',
        savingsFilter: type,
      }),
    ]);

    const combined = [...repayments.items, ...savingsEntries.items];
    combined.sort((a, b) => {
      const timestampDifference =
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (timestampDifference !== 0) return timestampDifference;

      const idDifference = b.id.localeCompare(a.id);
      return idDifference !== 0
        ? idDifference
        : b.source.localeCompare(a.source);
    });

    const total = repayments.total + savingsEntries.total;
    const startIndex = (page - 1) * limit;
    const items = combined.slice(startIndex, startIndex + limit);
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  private async fetchRepayments(params: {
    memberId?: string;
    centerId?: string;
    loanId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    fetchLimit: number;
    include: boolean;
  }): Promise<TransactionSourceResult> {
    const {
      include,
      memberId,
      centerId,
      loanId,
      startDate,
      endDate,
      search,
      fetchLimit,
    } = params;
    if (!include) {
      return { items: [], total: 0 };
    }

    const qb = this.repaymentRepo
      .createQueryBuilder('repayment')
      .leftJoin('repayment.member', 'member')
      .leftJoin('member.center', 'center')
      .leftJoin('repayment.loan', 'loan')
      .leftJoin('repayment.center', 'repaymentCenter');

    qb.andWhere('repayment.status = :status', {
      status: RepaymentStatus.APPROVED,
    });

    if (memberId) {
      qb.andWhere('member.id = :memberId', { memberId });
    }

    if (centerId) {
      qb.andWhere('(center.id = :centerId OR repaymentCenter.id = :centerId)', {
        centerId,
      });
    }

    if (loanId) {
      qb.andWhere('loan.id = :loanId', { loanId });
    }

    if (startDate) {
      const normalized = this.normalizeDate(startDate);
      if (normalized) {
        qb.andWhere('repayment.createdAt >= :startDate', {
          startDate: normalized,
        });
      }
    }

    if (endDate) {
      const normalized = this.normalizeDate(endDate, true);
      if (normalized) {
        qb.andWhere('repayment.createdAt <= :endDate', {
          endDate: normalized,
        });
      }
    }

    const searchPattern = this.toSearchPattern(search);
    if (searchPattern) {
      qb.andWhere(
        `(LOWER(CONCAT(COALESCE(member.lastName, ''), ', ', COALESCE(member.firstName, ''))) LIKE :search ESCAPE E'\\\\'
          OR LOWER(COALESCE(center.name, repaymentCenter.name, '')) LIKE :search ESCAPE E'\\\\')`,
        { search: searchPattern },
      );
    }

    const countQuery = qb.clone();
    const [rows, total] = await Promise.all([
      qb
        .select([
          'repayment.id AS "id"',
          'repayment.amount AS "amount"',
          'repayment.notes AS "notes"',
          'repayment."collectionDate"::text AS "collectionDate"',
          'repayment."paymentDate"::text AS "paymentDate"',
          'repayment.operationType AS "operationType"',
          `(
            repayment."operationType" = 'payment'
            AND NOT EXISTS (
              SELECT 1
              FROM "repayment" "blockingReversal"
              WHERE "blockingReversal"."relatedRepaymentId" = repayment.id
                AND "blockingReversal"."operationType" = 'reversal'
                AND "blockingReversal"."status" IN ('pending', 'approved')
            )
          ) AS "canReverse"`,
          `repayment."createdAt" AT TIME ZONE 'Asia/Manila' AS "createdAt"`,
          'member.id AS "memberId"',
          'member.firstName AS "memberFirstName"',
          'member.lastName AS "memberLastName"',
          'center.id AS "memberCenterId"',
          'center.name AS "memberCenterName"',
          'loan.id AS "loanId"',
          'loan.status AS "loanStatus"',
          'repaymentCenter.id AS "repaymentCenterId"',
          'repaymentCenter.name AS "repaymentCenterName"',
        ])
        .orderBy('repayment.createdAt', 'DESC')
        .addOrderBy('repayment.id', 'DESC')
        .limit(fetchLimit)
        .getRawMany<RepaymentHistoryRow>(),
      countQuery.getCount(),
    ]);
    return { items: rows.map((row) => this.mapRepayment(row)), total };
  }

  private async fetchSavings(params: {
    memberId?: string;
    centerId?: string;
    loanId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    fetchLimit: number;
    include: boolean;
    savingsFilter?: string;
  }): Promise<TransactionSourceResult> {
    const {
      include,
      memberId,
      centerId,
      loanId,
      startDate,
      endDate,
      search,
      fetchLimit,
      savingsFilter,
    } = params;
    if (!include) {
      return { items: [], total: 0 };
    }

    const qb = this.savingsRepo
      .createQueryBuilder('savings')
      .leftJoin('savings.borrower', 'member')
      .leftJoin('member.center', 'center')
      .leftJoin('savings.loan', 'loan');

    if (memberId) {
      qb.andWhere('member.id = :memberId', { memberId });
    }

    if (centerId) {
      qb.andWhere('center.id = :centerId', { centerId });
    }

    if (loanId) {
      qb.andWhere('loan.id = :loanId', { loanId });
    }

    if (startDate) {
      const normalized = this.normalizeDate(startDate);
      if (normalized) {
        qb.andWhere('savings.createdAt >= :startDate', {
          startDate: normalized,
        });
      }
    }

    if (endDate) {
      const normalized = this.normalizeDate(endDate, true);
      if (normalized) {
        qb.andWhere('savings.createdAt <= :endDate', { endDate: normalized });
      }
    }

    if (savingsFilter === 'savings_deposit') {
      qb.andWhere('savings.amount > 0');
    } else if (savingsFilter === 'savings_withdrawal') {
      qb.andWhere('savings.amount < 0');
    }

    const searchPattern = this.toSearchPattern(search);
    if (searchPattern) {
      qb.andWhere(
        `(LOWER(CONCAT(COALESCE(member.lastName, ''), ', ', COALESCE(member.firstName, ''))) LIKE :search ESCAPE E'\\\\'
          OR LOWER(COALESCE(center.name, '')) LIKE :search ESCAPE E'\\\\')`,
        { search: searchPattern },
      );
    }

    const countQuery = qb.clone();
    const [rows, total] = await Promise.all([
      qb
        .select([
          'savings.id AS "id"',
          'savings.amount AS "amount"',
          'savings.remarks AS "remarks"',
          `savings."createdAt" AT TIME ZONE 'Asia/Manila' AS "createdAt"`,
          'member.id AS "memberId"',
          'member.firstName AS "memberFirstName"',
          'member.lastName AS "memberLastName"',
          'center.id AS "centerId"',
          'center.name AS "centerName"',
          'loan.id AS "loanId"',
          'loan.status AS "loanStatus"',
        ])
        .orderBy('savings.createdAt', 'DESC')
        .addOrderBy('savings.id', 'DESC')
        .limit(fetchLimit)
        .getRawMany<SavingsHistoryRow>(),
      countQuery.getCount(),
    ]);
    return { items: rows.map((row) => this.mapSavings(row)), total };
  }

  private mapRepayment(repayment: RepaymentHistoryRow): TransactionHistoryItem {
    const amount = this.toNumber(repayment.amount);
    const collectionDate =
      repayment.collectionDate ??
      repayment.paymentDate ??
      this.toIsoString(repayment.createdAt).slice(0, 10) ??
      null;
    const operationType =
      repayment.operationType === RepaymentOperationType.REVERSAL
        ? 'reversal'
        : 'payment';
    const memberName = `${repayment.memberLastName ?? ''}, ${
      repayment.memberFirstName ?? ''
    }`.trim();
    return {
      id: repayment.id,
      type: 'repayment',
      amount,
      direction: operationType === 'reversal' ? 'debit' : 'credit',
      member: {
        id: repayment.memberId ?? null,
        name: memberName || 'Unknown Member',
        center: {
          id: repayment.memberCenterId ?? repayment.repaymentCenterId ?? null,
          name:
            repayment.memberCenterName ?? repayment.repaymentCenterName ?? null,
        },
      },
      loan: {
        id: repayment.loanId ?? null,
        status: repayment.loanStatus ?? null,
      },
      notes: repayment.notes ?? null,
      createdAt: this.toIsoString(repayment.createdAt),
      collectionDate,
      source: 'repayment',
      repaymentOperationType: operationType,
      canReverse: operationType === 'payment' && repayment.canReverse === true,
    };
  }

  private mapSavings(savings: SavingsHistoryRow): TransactionHistoryItem {
    const signedAmount = this.toNumber(savings.amount);
    const amount = Math.abs(signedAmount);
    const type: TransactionType =
      signedAmount >= 0 ? 'savings_deposit' : 'savings_withdrawal';
    const memberName = `${savings.memberLastName ?? ''}, ${
      savings.memberFirstName ?? ''
    }`.trim();

    return {
      id: savings.id,
      type,
      amount,
      direction: type === 'savings_deposit' ? 'credit' : 'debit',
      member: {
        id: savings.memberId ?? null,
        name: memberName || 'Unknown Member',
        center: {
          id: savings.centerId ?? null,
          name: savings.centerName ?? null,
        },
      },
      loan: {
        id: savings.loanId ?? null,
        status: savings.loanStatus ?? null,
      },
      notes: savings.remarks ?? null,
      createdAt: this.toIsoString(savings.createdAt),
      source: 'savings',
      canReverse: false,
    };
  }

  private normalizeDate(value?: string, endOfDay = false): string | undefined {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }
    if (endOfDay) {
      parsed.setHours(23, 59, 59, 999);
    }
    return parsed.toISOString();
  }

  private toSearchPattern(value?: string): string | undefined {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) return undefined;

    return `%${normalized.replace(/[\\%_]/g, '\\$&')}%`;
  }

  private toIsoString(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime())
      ? new Date().toISOString()
      : date.toISOString();
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }
}
