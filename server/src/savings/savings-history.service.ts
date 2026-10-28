import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Member } from '../members/entities/member.entity';
import {
  LedgerSavingsHistoryItem,
  LegacySavingsHistoryItem,
  SavingsHistoryResponse,
} from './dto/savings-history-response.dto';
import {
  SavingsHistoryQueryDto,
  SavingsHistoryScope,
} from './dto/savings-history-query.dto';
import { Savings, SavingsEventType } from './savings.entity';

interface RawSavingsHistoryRow {
  id: string;
  eventType: SavingsEventType | null;
  amount: string;
  balanceBefore: string | null;
  balanceAfter: string | null;
  businessDate: string | null;
  createdAt: Date;
  remarks: string | null;
  loanId: string | null;
  referenceType: string | null;
  referenceId: string | null;
  reversalOfId: string | null;
  performedById: string | null;
  actorFirstName: string | null;
  actorMiddleName: string | null;
  actorLastName: string | null;
}

@Injectable()
export class SavingsHistoryService {
  constructor(
    @InjectRepository(Savings)
    private readonly savingsRepository: Repository<Savings>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
  ) {}

  async findMemberHistory(
    memberId: string,
    query: SavingsHistoryQueryDto,
  ): Promise<SavingsHistoryResponse> {
    const member = await this.memberRepository.findOne({
      select: { id: true },
      where: { id: memberId },
    });
    if (!member) {
      throw new NotFoundException(`Member #${memberId} not found`);
    }

    const { scope, page = 1, limit = 25 } = query;
    const countQuery = this.scopedQuery(memberId, scope);
    const pageQuery = this.scopedQuery(memberId, scope)
      .orderBy('savings.createdAt', 'DESC')
      .addOrderBy('savings.id', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);

    if (scope === SavingsHistoryScope.LEDGER) {
      pageQuery
        .leftJoin('savings.performedBy', 'actor')
        .select([
          'savings.id AS "id"',
          'savings.eventType AS "eventType"',
          'savings.amount AS "amount"',
          'savings.balanceBefore AS "balanceBefore"',
          'savings.balanceAfter AS "balanceAfter"',
          'savings."businessDate"::text AS "businessDate"',
          `savings."createdAt" AT TIME ZONE 'Asia/Manila' AS "createdAt"`,
          'savings.remarks AS "remarks"',
          'savings.loanId AS "loanId"',
          'savings.referenceType AS "referenceType"',
          'savings.referenceId AS "referenceId"',
          'savings.reversalOfId AS "reversalOfId"',
          'actor.id AS "performedById"',
          'actor.firstName AS "actorFirstName"',
          'actor.middleName AS "actorMiddleName"',
          'actor.lastName AS "actorLastName"',
        ]);
    } else {
      pageQuery.select([
        'savings.id AS "id"',
        'savings.amount AS "amount"',
        `savings."createdAt" AT TIME ZONE 'Asia/Manila' AS "createdAt"`,
        'savings.remarks AS "remarks"',
      ]);
    }

    const [total, rows] = await Promise.all([
      countQuery.getCount(),
      pageQuery.getRawMany<RawSavingsHistoryRow>(),
    ]);
    const pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };

    if (scope === SavingsHistoryScope.LEDGER) {
      return {
        scope,
        items: rows.map((row) => this.mapLedgerRow(row)),
        pagination,
      };
    }

    return {
      scope,
      items: rows.map((row) => this.mapLegacyRow(row)),
      pagination,
    };
  }

  private scopedQuery(
    memberId: string,
    scope: SavingsHistoryScope,
  ): SelectQueryBuilder<Savings> {
    const query = this.savingsRepository
      .createQueryBuilder('savings')
      .where('savings."borrowerId" = :memberId', { memberId });

    return scope === SavingsHistoryScope.LEDGER
      ? query.andWhere('savings."eventType" IS NOT NULL')
      : query.andWhere('savings."eventType" IS NULL');
  }

  private mapLedgerRow(row: RawSavingsHistoryRow): LedgerSavingsHistoryItem {
    if (
      !row.eventType ||
      row.balanceBefore === null ||
      row.balanceAfter === null ||
      row.businessDate === null
    ) {
      throw new Error(`Incomplete ledger savings row ${row.id}`);
    }

    return {
      recordClass: SavingsHistoryScope.LEDGER,
      id: row.id,
      eventType: row.eventType,
      amount: this.decimal(row.amount),
      balanceBefore: this.decimal(row.balanceBefore),
      balanceAfter: this.decimal(row.balanceAfter),
      businessDate: row.businessDate,
      createdAt: row.createdAt,
      remarks: row.remarks,
      loanId: row.loanId,
      performedBy: row.performedById
        ? {
            id: row.performedById,
            name: [row.actorFirstName, row.actorMiddleName, row.actorLastName]
              .filter((value): value is string => Boolean(value))
              .join(' '),
          }
        : null,
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      reversalOfId: row.reversalOfId,
    };
  }

  private mapLegacyRow(row: RawSavingsHistoryRow): LegacySavingsHistoryItem {
    const amount = this.decimal(row.amount);

    return {
      recordClass: SavingsHistoryScope.LEGACY,
      id: row.id,
      amount,
      direction:
        amount === '0.00' ? null : amount.startsWith('-') ? 'debit' : 'credit',
      createdAt: row.createdAt,
      remarks: row.remarks,
    };
  }

  private decimal(value: string): string {
    const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
    if (!match) {
      throw new Error(`Invalid persisted savings amount: ${value}`);
    }

    return `${match[1]}${match[2]}.${(match[3] ?? '').padEnd(2, '0')}`;
  }
}
