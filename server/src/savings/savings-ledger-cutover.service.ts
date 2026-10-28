import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  IsNull,
  LessThan,
  Not,
  Repository,
} from 'typeorm';
import { getFinancialBusinessDate } from '../common/financial-business-date';
import { Loan } from '../loans/loan.entity';
import { LoansService } from '../loans/loans.service';
import { Member } from '../members/entities/member.entity';
import { Savings, SavingsEventType } from './savings.entity';

export const SAVINGS_OPENING_REMARKS = 'Savings ledger opening balance';
export const SAVINGS_OPENING_CONFIRMATION = 'savings-opening-v1';

export function savingsOpeningIdempotencyKey(memberId: string): string {
  return `savings-opening:v1:${memberId}`;
}

export type SavingsCutoverDisposition =
  | 'eligible'
  | 'already_cut_over'
  | 'no_authoritative_loan'
  | 'blocked';

export type SavingsCutoverBlockerCode =
  | 'multiple_active_loans'
  | 'latest_loan_tie'
  | 'financial_evidence_without_loan'
  | 'invalid_authoritative_savings'
  | 'pre_opening_ledger_rows'
  | 'suspicious_opening';

export interface SavingsCutoverMemberAssessment {
  memberId: string;
  authoritativeLoanId: string | null;
  authoritativeLoanStatus: Loan['status'] | null;
  authoritativeSavings: string | null;
  expectedIdempotencyKey: string;
  financialEvidenceRows: number;
  completeLedgerRows: number;
  zeroBalance: boolean;
  disposition: SavingsCutoverDisposition;
  blockerCode?: SavingsCutoverBlockerCode;
  message: string;
}

export interface SavingsCutoverPreflightSummary {
  membersScanned: number;
  eligibleOpenings: number;
  alreadyCutOver: number;
  noAuthoritativeLoan: number;
  zeroBalanceOpenings: number;
  ambiguousAuthoritativeLoan: number;
  financialEvidenceWithoutLoan: number;
  invalidAuthoritativeSavings: number;
  preOpeningLedgerBlockers: number;
  suspiciousOpenings: number;
  blockers: number;
}

export interface SavingsCutoverPreflight {
  businessDate: string;
  summary: SavingsCutoverPreflightSummary;
  members: SavingsCutoverMemberAssessment[];
}

export interface SavingsCutoverMemberResult {
  memberId: string;
  result: 'created' | 'already_cut_over' | 'failed';
  message: string;
}

export interface SavingsLedgerCutoverResult {
  mode: 'dry-run' | 'apply';
  businessDate: string;
  preflight: SavingsCutoverPreflight;
  created: number;
  alreadyCutOver: number;
  failed: number;
  memberResults: SavingsCutoverMemberResult[];
}

export interface SavingsLedgerCutoverOptions {
  apply?: boolean;
  at?: Date;
}

export class SavingsLedgerCutoverBlockedError extends Error {
  constructor(public readonly preflight: SavingsCutoverPreflight) {
    super(
      `Savings ledger cutover blocked by ${preflight.summary.blockers} member assessment(s)`,
    );
    this.name = 'SavingsLedgerCutoverBlockedError';
  }
}

class SavingsLedgerCutoverMemberStateError extends Error {}

function normalizeStoredBalance(value: unknown): string {
  if (value === null || value === undefined) {
    throw new Error('balance is null');
  }

  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new Error('balance has an unsupported type');
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('balance is not finite');
  }

  const raw = typeof value === 'number' ? String(value) : value.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match) {
    throw new Error('balance is not a finite two-decimal number');
  }

  const whole = match[2].replace(/^0+(?=\d)/, '');
  const fraction = (match[3] ?? '').padEnd(2, '0');
  const absoluteCents = BigInt(whole) * 100n + BigInt(fraction);
  if (absoluteCents > 999_999_999_999n) {
    throw new Error('balance exceeds numeric(12,2)');
  }
  if (match[1] === '-' && absoluteCents !== 0n) {
    throw new Error('balance is negative');
  }

  return `${whole}.${fraction}`;
}

function tryNormalizeStoredBalance(value: unknown): string | null {
  try {
    return normalizeStoredBalance(value);
  } catch {
    return null;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

@Injectable()
export class SavingsLedgerCutoverService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    @InjectRepository(Savings)
    private readonly savingsRepository: Repository<Savings>,
    private readonly loansService: LoansService,
  ) {}

  async run(
    options: SavingsLedgerCutoverOptions = {},
  ): Promise<SavingsLedgerCutoverResult> {
    const businessDate = getFinancialBusinessDate(options.at);
    const preflight = await this.preflight(businessDate);

    if (!options.apply) {
      return {
        mode: 'dry-run',
        businessDate,
        preflight,
        created: 0,
        alreadyCutOver: preflight.summary.alreadyCutOver,
        failed: 0,
        memberResults: [],
      };
    }

    if (preflight.summary.blockers > 0) {
      throw new SavingsLedgerCutoverBlockedError(preflight);
    }

    const memberResults: SavingsCutoverMemberResult[] = [];
    let created = 0;
    let alreadyCutOver = preflight.summary.alreadyCutOver;
    let failed = 0;

    for (const assessment of preflight.members) {
      if (assessment.disposition !== 'eligible') continue;

      try {
        const result = await this.applyMember(assessment, businessDate);
        memberResults.push(result);
        if (result.result === 'created') created += 1;
        if (result.result === 'already_cut_over') alreadyCutOver += 1;
      } catch (error) {
        if (isUniqueViolation(error)) {
          const concurrentState = await this.inspectMember(assessment.memberId);
          if (concurrentState.disposition === 'already_cut_over') {
            alreadyCutOver += 1;
            memberResults.push({
              memberId: assessment.memberId,
              result: 'already_cut_over',
              message: 'Opening balance was created by a concurrent run.',
            });
            continue;
          }
        }

        failed += 1;
        memberResults.push({
          memberId: assessment.memberId,
          result: 'failed',
          message:
            error instanceof SavingsLedgerCutoverMemberStateError
              ? error.message
              : 'Opening balance transaction failed.',
        });
      }
    }

    return {
      mode: 'apply',
      businessDate,
      preflight,
      created,
      alreadyCutOver,
      failed,
      memberResults,
    };
  }

  async preflight(
    businessDate = getFinancialBusinessDate(),
  ): Promise<SavingsCutoverPreflight> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      throw new Error('Cutover business date must use YYYY-MM-DD');
    }

    const members = await this.memberRepository.find({
      select: { id: true },
      order: { id: 'ASC' },
    });
    const assessments: SavingsCutoverMemberAssessment[] = [];

    for (const member of members) {
      assessments.push(await this.inspectMember(member.id));
    }

    return {
      businessDate,
      summary: this.summarize(assessments),
      members: assessments,
    };
  }

  private async inspectMember(
    memberId: string,
    manager?: EntityManager,
  ): Promise<SavingsCutoverMemberAssessment> {
    const savingsRepository =
      manager?.getRepository(Savings) ?? this.savingsRepository;
    const expectedIdempotencyKey = savingsOpeningIdempotencyKey(memberId);
    const [financialEvidenceRows, completeLedgerRows] = await Promise.all([
      savingsRepository.count({ where: { borrowerId: memberId } }),
      savingsRepository.count({
        where: { borrowerId: memberId, eventType: Not(IsNull()) },
      }),
    ]);

    let authoritativeLoan: Loan | null;
    try {
      authoritativeLoan =
        await this.loansService.findAuthoritativeSavingsLoanForMember(
          memberId,
          manager,
        );
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;

      const message = error instanceof Error ? error.message : '';
      const multipleActive = message.includes('multiple active loans');
      return {
        memberId,
        authoritativeLoanId: null,
        authoritativeLoanStatus: null,
        authoritativeSavings: null,
        expectedIdempotencyKey,
        financialEvidenceRows,
        completeLedgerRows,
        zeroBalance: false,
        disposition: 'blocked',
        blockerCode: multipleActive
          ? 'multiple_active_loans'
          : 'latest_loan_tie',
        message: multipleActive
          ? 'Member has multiple active loans.'
          : 'Member has tied latest historical loans.',
      };
    }

    if (!authoritativeLoan) {
      return {
        memberId,
        authoritativeLoanId: null,
        authoritativeLoanStatus: null,
        authoritativeSavings: null,
        expectedIdempotencyKey,
        financialEvidenceRows,
        completeLedgerRows,
        zeroBalance: false,
        disposition:
          financialEvidenceRows > 0 ? 'blocked' : 'no_authoritative_loan',
        blockerCode:
          financialEvidenceRows > 0
            ? 'financial_evidence_without_loan'
            : undefined,
        message:
          financialEvidenceRows > 0
            ? 'Savings evidence exists without an authoritative loan.'
            : 'Member has no loan and no savings evidence.',
      };
    }

    const authoritativeSavings = tryNormalizeStoredBalance(
      authoritativeLoan.savings,
    );
    if (authoritativeSavings === null) {
      return {
        memberId,
        authoritativeLoanId: authoritativeLoan.id,
        authoritativeLoanStatus: authoritativeLoan.status,
        authoritativeSavings: null,
        expectedIdempotencyKey,
        financialEvidenceRows,
        completeLedgerRows,
        zeroBalance: false,
        disposition: 'blocked',
        blockerCode: 'invalid_authoritative_savings',
        message: 'Authoritative loan savings is invalid or negative.',
      };
    }

    const openingCandidates = await savingsRepository.find({
      where: [
        { borrowerId: memberId, eventType: SavingsEventType.OPENING_BALANCE },
        { idempotencyKey: expectedIdempotencyKey },
      ],
      relations: { loan: true },
    });
    const validOpening =
      openingCandidates.length === 1 &&
      this.isValidOpening(openingCandidates[0], memberId)
        ? openingCandidates[0]
        : null;

    if (openingCandidates.length > 0 && !validOpening) {
      return {
        memberId,
        authoritativeLoanId: authoritativeLoan.id,
        authoritativeLoanStatus: authoritativeLoan.status,
        authoritativeSavings,
        expectedIdempotencyKey,
        financialEvidenceRows,
        completeLedgerRows,
        zeroBalance: authoritativeSavings === '0.00',
        disposition: 'blocked',
        blockerCode: 'suspicious_opening',
        message:
          'Existing opening balance does not match the cutover contract.',
      };
    }

    if (validOpening) {
      const rowsBeforeOpening = await savingsRepository.count({
        where: {
          borrowerId: memberId,
          eventType: Not(SavingsEventType.OPENING_BALANCE),
          createdAt: LessThan(validOpening.createdAt),
        },
      });
      if (rowsBeforeOpening > 0) {
        return {
          memberId,
          authoritativeLoanId: authoritativeLoan.id,
          authoritativeLoanStatus: authoritativeLoan.status,
          authoritativeSavings,
          expectedIdempotencyKey,
          financialEvidenceRows,
          completeLedgerRows,
          zeroBalance: authoritativeSavings === '0.00',
          disposition: 'blocked',
          blockerCode: 'pre_opening_ledger_rows',
          message: 'Complete ledger rows predate the opening balance.',
        };
      }

      return {
        memberId,
        authoritativeLoanId: authoritativeLoan.id,
        authoritativeLoanStatus: authoritativeLoan.status,
        authoritativeSavings,
        expectedIdempotencyKey,
        financialEvidenceRows,
        completeLedgerRows,
        zeroBalance: authoritativeSavings === '0.00',
        disposition: 'already_cut_over',
        message: 'Valid deterministic opening balance already exists.',
      };
    }

    if (completeLedgerRows > 0) {
      return {
        memberId,
        authoritativeLoanId: authoritativeLoan.id,
        authoritativeLoanStatus: authoritativeLoan.status,
        authoritativeSavings,
        expectedIdempotencyKey,
        financialEvidenceRows,
        completeLedgerRows,
        zeroBalance: authoritativeSavings === '0.00',
        disposition: 'blocked',
        blockerCode: 'pre_opening_ledger_rows',
        message: 'Complete ledger rows exist without an opening balance.',
      };
    }

    return {
      memberId,
      authoritativeLoanId: authoritativeLoan.id,
      authoritativeLoanStatus: authoritativeLoan.status,
      authoritativeSavings,
      expectedIdempotencyKey,
      financialEvidenceRows,
      completeLedgerRows,
      zeroBalance: authoritativeSavings === '0.00',
      disposition: 'eligible',
      message: 'Member is eligible for an opening balance.',
    };
  }

  private isValidOpening(row: Savings, memberId: string): boolean {
    const amount = tryNormalizeStoredBalance(row.amount);
    const balanceBefore = tryNormalizeStoredBalance(row.balanceBefore);
    const balanceAfter = tryNormalizeStoredBalance(row.balanceAfter);

    return (
      row.eventType === SavingsEventType.OPENING_BALANCE &&
      row.borrowerId === memberId &&
      row.idempotencyKey === savingsOpeningIdempotencyKey(memberId) &&
      Boolean(row.loan?.id) &&
      amount !== null &&
      balanceBefore === '0.00' &&
      balanceAfter === amount &&
      typeof row.businessDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.businessDate) &&
      row.performedById === null &&
      row.referenceType === null &&
      row.referenceId === null &&
      row.reversalOfId === null
    );
  }

  private async applyMember(
    preflight: SavingsCutoverMemberAssessment,
    businessDate: string,
  ): Promise<SavingsCutoverMemberResult> {
    return this.dataSource.transaction(async (manager) => {
      const candidate =
        await this.loansService.findAuthoritativeSavingsLoanForMember(
          preflight.memberId,
          manager,
        );
      if (!candidate) {
        throw new SavingsLedgerCutoverMemberStateError(
          'Authoritative loan disappeared after preflight.',
        );
      }

      const lockedLoan = await manager
        .getRepository(Loan)
        .createQueryBuilder('loan')
        .setLock('pessimistic_write')
        .where('loan.id = :loanId', { loanId: candidate.id })
        .getOne();
      if (!lockedLoan) {
        throw new SavingsLedgerCutoverMemberStateError(
          'Authoritative loan disappeared while acquiring its lock.',
        );
      }

      const current = await this.inspectMember(preflight.memberId, manager);
      if (current.disposition === 'already_cut_over') {
        return {
          memberId: preflight.memberId,
          result: 'already_cut_over',
          message: 'Opening balance already exists.',
        };
      }
      if (current.disposition !== 'eligible') {
        throw new SavingsLedgerCutoverMemberStateError(
          `Member state changed after preflight: ${current.message}`,
        );
      }
      if (
        current.authoritativeLoanId !== preflight.authoritativeLoanId ||
        current.authoritativeSavings !== preflight.authoritativeSavings
      ) {
        throw new SavingsLedgerCutoverMemberStateError(
          'Authoritative loan or savings balance changed after preflight.',
        );
      }

      const amount = Number(current.authoritativeSavings);
      const savingsRepository = manager.getRepository(Savings);
      const opening = savingsRepository.create({
        borrower: { id: preflight.memberId } as Member,
        loan: lockedLoan,
        amount,
        remarks: SAVINGS_OPENING_REMARKS,
        eventType: SavingsEventType.OPENING_BALANCE,
        balanceBefore: 0,
        balanceAfter: amount,
        businessDate,
        referenceType: null,
        referenceId: null,
        idempotencyKey: preflight.expectedIdempotencyKey,
        performedById: null,
        reversalOfId: null,
      });
      await savingsRepository.save(opening);

      return {
        memberId: preflight.memberId,
        result: 'created',
        message: 'Opening balance created.',
      };
    });
  }

  private summarize(
    members: SavingsCutoverMemberAssessment[],
  ): SavingsCutoverPreflightSummary {
    const countBlocker = (code: SavingsCutoverBlockerCode) =>
      members.filter((member) => member.blockerCode === code).length;

    return {
      membersScanned: members.length,
      eligibleOpenings: members.filter(
        (member) => member.disposition === 'eligible',
      ).length,
      alreadyCutOver: members.filter(
        (member) => member.disposition === 'already_cut_over',
      ).length,
      noAuthoritativeLoan: members.filter(
        (member) => member.disposition === 'no_authoritative_loan',
      ).length,
      zeroBalanceOpenings: members.filter(
        (member) => member.disposition === 'eligible' && member.zeroBalance,
      ).length,
      ambiguousAuthoritativeLoan:
        countBlocker('multiple_active_loans') + countBlocker('latest_loan_tie'),
      financialEvidenceWithoutLoan: countBlocker(
        'financial_evidence_without_loan',
      ),
      invalidAuthoritativeSavings: countBlocker(
        'invalid_authoritative_savings',
      ),
      preOpeningLedgerBlockers: countBlocker('pre_opening_ledger_rows'),
      suspiciousOpenings: countBlocker('suspicious_opening'),
      blockers: members.filter((member) => member.disposition === 'blocked')
        .length,
    };
  }
}
