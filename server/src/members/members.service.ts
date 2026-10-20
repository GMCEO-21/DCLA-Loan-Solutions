import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, DataSource } from 'typeorm';
import { Member } from './entities/member.entity';
import { Center } from '../centers/entities/center.entity';
import { Loan } from '../loans/loan.entity';
import { Repayment } from '../repayments/repayment.entity';
import { Savings, SavingsEventType } from '../savings/savings.entity';
import { repaymentSavingsDebitIdempotencyKey } from '../savings/savings-ledger.utils';
import { Collection } from '../collections/entities/collection.entity';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { FindMembersQueryDto } from './dto/find-members-query.dto';
import { LoanRepaymentSchedule } from '../repayments/entities/loan-repayment-schedule.entity';
import {
  RepaymentOperationType,
  RepaymentStatus,
} from '../repayments/repayment.entity';
import {
  addDaysToDateOnly,
  getSaturdayFridayWeekRange,
  parseDateOnly,
} from '../common/date-only';
import { buildContractualDueDates } from '../repayments/contractual-schedule-plan';
import { buildLoanRepaymentBreakdown } from '../repayments/loan-repayment-schedule.utils';

type WeeklyFinancialKind =
  | 'scheduled_week'
  | 'post_maturity_no_weekly_obligation'
  | 'pre_first_due_no_weekly_obligation'
  | 'historical_funding_unavailable'
  | 'missing_schedule_unexpectedly';

interface LoanWeeklyFinancialProjection {
  kind: WeeklyFinancialKind;
  amountDue: number | null;
  amountApplied: number | null;
}

interface SyntheticInstallment {
  dueDate: string;
  amountDueCents: number;
}

export type LoanConditionStatus =
  | 'normal'
  | 'past_due'
  | 'past_maturity'
  | 'indeterminate';

export interface LoanConditionProjection {
  status: LoanConditionStatus;
}

export function aggregateLoanConditions(
  conditions: LoanConditionProjection[],
): LoanConditionProjection {
  if (conditions.some(({ status }) => status === 'past_maturity')) {
    return { status: 'past_maturity' };
  }
  if (conditions.some(({ status }) => status === 'past_due')) {
    return { status: 'past_due' };
  }
  if (conditions.some(({ status }) => status === 'indeterminate')) {
    return { status: 'indeterminate' };
  }
  return { status: 'normal' };
}

@Injectable()
export class MembersService {
  constructor(
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    @InjectRepository(Center)
    private readonly centerRepository: Repository<Center>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(Repayment)
    private readonly repaymentRepository: Repository<Repayment>,
    @InjectRepository(Savings)
    private readonly savingsRepository: Repository<Savings>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createMemberDto: CreateMemberDto): Promise<Member> {
    const { centerId, ...memberData } = createMemberDto;

    let center: Center | undefined = undefined;
    if (centerId) {
      center =
        (await this.centerRepository.findOne({ where: { id: centerId } })) ||
        undefined;
      if (!center) throw new NotFoundException(`Center #${centerId} not found`);
    }

    const member = this.memberRepository.create({
      ...memberData,
      center,
    });
    return this.memberRepository.save(member);
  }

  async findAll(query?: FindMembersQueryDto): Promise<
    | {
        items: Member[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }
    | Member[]
  > {
    // Backward compatibility if no query provided
    if (!query) {
      return this.memberRepository.find({ relations: ['center'] });
    }

    const { page = 1, limit = 10, search, centerId } = query;

    const qb = this.memberRepository
      .createQueryBuilder('member')
      .leftJoinAndSelect('member.center', 'center');

    if (centerId) {
      qb.andWhere('center.id = :centerId', { centerId });
    }

    if (search && search.trim().length > 0) {
      const term = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(member.firstName) LIKE :term OR LOWER(member.middleName) LIKE :term OR LOWER(member.lastName) LIKE :term)',
        { term },
      );
    }

    qb.orderBy('member.lastName', 'ASC')
      .addOrderBy('member.firstName', 'ASC')
      .addOrderBy('member.middleName', 'ASC')
      .addOrderBy('member.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string): Promise<Member> {
    const member = await this.memberRepository.findOne({ where: { id } });
    if (!member) throw new NotFoundException(`Member #${id} not found`);
    return member;
  }

  async update(id: string, updateMemberDto: UpdateMemberDto): Promise<Member> {
    const { centerId, ...memberData } = updateMemberDto;

    let center: Center | undefined = undefined;
    if (centerId) {
      center =
        (await this.centerRepository.findOne({ where: { id: centerId } })) ||
        undefined;
      if (!center) throw new NotFoundException(`Center #${centerId} not found`);
    }

    const member = await this.memberRepository.preload({
      id,
      ...memberData,
      center,
    });
    if (!member) throw new NotFoundException(`Member #${id} not found`);
    return this.memberRepository.save(member);
  }

  async remove(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const member = await manager.findOne(Member, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!member) {
        throw new NotFoundException(`Member #${id} not found`);
      }

      const hasFinancialHistory =
        (await manager.exists(Loan, { where: { borrower: { id } } })) ||
        (await manager.exists(Savings, { where: { borrower: { id } } })) ||
        (await manager.exists(Repayment, { where: { member: { id } } })) ||
        (await manager.exists(Collection, { where: { memberId: id } }));

      if (hasFinancialHistory) {
        throw new ConflictException(
          'Member cannot be deleted because financial history exists',
        );
      }

      await manager.delete(Member, { id });
    });
  }

  /**
   * Get all members for a specific center with loan information
   */
  async getCenterMembers(centerId: string, date?: string) {
    const members = await this.memberRepository.find({
      where: { center: { id: centerId } },
      relations: ['center'],
    });

    if (members.length === 0) {
      return [];
    }

    const loanQuery = this.loanRepository
      .createQueryBuilder('loan')
      .innerJoinAndSelect('loan.borrower', 'borrower')
      .where('borrower.id IN (:...memberIds)', {
        memberIds: members.map((member) => member.id),
      });

    if (date) {
      loanQuery.andWhere(
        `(loan.status = :activeStatus OR
          COALESCE(loan."loanCreatedDate", loan."createdAt")::date = :referenceDate)`,
        { activeStatus: 'active', referenceDate: date },
      );
    }

    const loans = await loanQuery.getMany();
    const weeklyFundingByMember = new Map<
      string,
      {
        paid: boolean;
        hasAllocation: boolean;
        amountDue: number;
        amountApplied: number;
      }
    >();
    const weeklyFinancialByMember = new Map<
      string,
      {
        kind: WeeklyFinancialKind;
        amountDue: number | null;
        amountApplied: number | null;
        postMaturityLoanCount: number;
        incompleteScheduleLoanCount: number;
      }
    >();
    const loanConditionByMember = new Map<string, LoanConditionProjection>();
    const activeLoans = loans.filter((loan) => loan.status === 'active');
    if (date && activeLoans.length > 0) {
      const selectedDate = parseDateOnly(date).value;
      const { weekStart, weekEnd } = getSaturdayFridayWeekRange(selectedDate);
      const schedules = await this.dataSource
        .getRepository(LoanRepaymentSchedule)
        .find({
          where: {
            loanId: In(activeLoans.map((loan) => loan.id)),
          },
          relations: ['allocations', 'allocations.repayment'],
        });
      const approvedRepayments = await this.repaymentRepository.find({
        where: {
          loan: { id: In(activeLoans.map((loan) => loan.id)) },
          status: RepaymentStatus.APPROVED,
        },
        relations: ['loan'],
      });
      const memberIdByLoanId = new Map(
        activeLoans.map((loan) => [loan.id, loan.borrower.id]),
      );
      const fundingByMember = new Map<
        string,
        { dueCents: number; appliedCents: number }
      >();

      const schedulesByLoan = new Map<string, LoanRepaymentSchedule[]>();
      for (const schedule of schedules) {
        const loanSchedules = schedulesByLoan.get(schedule.loanId) ?? [];
        loanSchedules.push(schedule);
        schedulesByLoan.set(schedule.loanId, loanSchedules);
      }
      const repaymentsByLoan = new Map<string, Repayment[]>();
      for (const repayment of approvedRepayments) {
        const loanId = repayment.loan?.id;
        if (!loanId) continue;
        const loanRepayments = repaymentsByLoan.get(loanId) ?? [];
        loanRepayments.push(repayment);
        repaymentsByLoan.set(loanId, loanRepayments);
      }

      const legacyCandidateLoans = activeLoans.filter(
        (loan) =>
          (schedulesByLoan.get(loan.id) ?? []).length === 0 &&
          loan.overdueChargePolicyVersion === null &&
          loan.overdueChargePolicyEffectiveDate === null,
      );
      const stableReleaseDateByLoan = await this.loadStableReleaseDates(
        legacyCandidateLoans.map((loan) => loan.id),
      );
      const legacyCandidateLoanIds = new Set(
        legacyCandidateLoans.map((loan) => loan.id),
      );
      const legacySavingsDebits = await this.loadLegacySavingsDebits(
        approvedRepayments.filter(
          (repayment) =>
            repayment.loan?.id &&
            legacyCandidateLoanIds.has(repayment.loan.id) &&
            repayment.operationType === RepaymentOperationType.PAYMENT,
        ),
      );

      const selectedWeekSchedules = schedules.filter(
        (schedule) =>
          schedule.dueDate >= weekStart && schedule.dueDate <= weekEnd,
      );
      for (const schedule of selectedWeekSchedules) {
        const memberId = memberIdByLoanId.get(schedule.loanId);
        if (!memberId) continue;
        const funding = fundingByMember.get(memberId) ?? {
          dueCents: 0,
          appliedCents: 0,
        };
        funding.dueCents += Math.round(Number(schedule.amountDue) * 100);
        funding.appliedCents += (schedule.allocations ?? []).reduce(
          (sum, allocation) =>
            allocation.repayment?.status === RepaymentStatus.APPROVED &&
            allocation.repayment.operationType ===
              RepaymentOperationType.PAYMENT
              ? sum + Math.round(Number(allocation.amountApplied) * 100)
              : sum,
          0,
        );
        fundingByMember.set(memberId, funding);
      }

      for (const [memberId, funding] of fundingByMember) {
        if (funding.dueCents > 0) {
          weeklyFundingByMember.set(memberId, {
            paid: funding.appliedCents >= funding.dueCents,
            hasAllocation: funding.appliedCents > 0,
            amountDue: funding.dueCents / 100,
            amountApplied: funding.appliedCents / 100,
          });
        }
      }

      const financialByLoan = new Map<string, LoanWeeklyFinancialProjection>();
      const conditionByLoan = new Map<string, LoanConditionProjection>();
      for (const loan of activeLoans) {
        const member = members.find(({ id }) => id === loan.borrower.id);
        financialByLoan.set(
          loan.id,
          this.classifyWeeklyFinancialState(
            loan,
            schedulesByLoan.get(loan.id) ?? [],
            repaymentsByLoan.get(loan.id) ?? [],
            legacySavingsDebits,
            stableReleaseDateByLoan.get(loan.id) ?? null,
            member?.center?.collectionDay,
            selectedDate,
            weekStart,
            weekEnd,
          ),
        );
        conditionByLoan.set(
          loan.id,
          this.classifyLoanCondition(
            loan,
            schedulesByLoan.get(loan.id) ?? [],
            repaymentsByLoan.get(loan.id) ?? [],
            member?.center?.collectionDay,
            stableReleaseDateByLoan.get(loan.id) ?? null,
            selectedDate,
            weekStart,
          ),
        );
      }

      for (const member of members) {
        const memberActiveLoans = activeLoans.filter(
          (loan) => loan.borrower.id === member.id,
        );
        if (memberActiveLoans.length === 0) continue;

        const projections = memberActiveLoans.map(
          (loan) =>
            financialByLoan.get(loan.id) ?? {
              kind: 'missing_schedule_unexpectedly' as const,
              amountDue: null,
              amountApplied: null,
            },
        );
        loanConditionByMember.set(
          member.id,
          aggregateLoanConditions(
            memberActiveLoans.map(
              (loan) =>
                conditionByLoan.get(loan.id) ?? { status: 'indeterminate' },
            ),
          ),
        );
        const postMaturityLoanCount = projections.filter(
          ({ kind }) => kind === 'post_maturity_no_weekly_obligation',
        ).length;
        const incompleteScheduleLoanCount = projections.filter(
          ({ kind }) => kind === 'missing_schedule_unexpectedly',
        ).length;
        const scheduled = projections.filter(
          (projection) => projection.kind === 'scheduled_week',
        );
        const fundingUnavailable = projections.some(
          ({ kind }) => kind === 'historical_funding_unavailable',
        );
        const preFirstDue = projections.some(
          ({ kind }) => kind === 'pre_first_due_no_weekly_obligation',
        );

        if (incompleteScheduleLoanCount > 0) {
          weeklyFinancialByMember.set(member.id, {
            kind: 'missing_schedule_unexpectedly',
            amountDue: null,
            amountApplied: null,
            postMaturityLoanCount,
            incompleteScheduleLoanCount,
          });
        } else if (fundingUnavailable) {
          weeklyFinancialByMember.set(member.id, {
            kind: 'historical_funding_unavailable',
            amountDue: null,
            amountApplied: null,
            postMaturityLoanCount,
            incompleteScheduleLoanCount: 0,
          });
        } else if (scheduled.length > 0) {
          const amountDue = scheduled.reduce(
            (sum, projection) => sum + Number(projection.amountDue),
            0,
          );
          const amountApplied = scheduled.reduce(
            (sum, projection) => sum + Number(projection.amountApplied),
            0,
          );
          weeklyFinancialByMember.set(member.id, {
            kind: 'scheduled_week',
            amountDue,
            amountApplied,
            postMaturityLoanCount,
            incompleteScheduleLoanCount: 0,
          });
          weeklyFundingByMember.set(member.id, {
            paid: amountApplied >= amountDue,
            hasAllocation: amountApplied > 0,
            amountDue,
            amountApplied,
          });
        } else {
          weeklyFinancialByMember.set(member.id, {
            kind:
              preFirstDue && postMaturityLoanCount === 0
                ? 'pre_first_due_no_weekly_obligation'
                : 'post_maturity_no_weekly_obligation',
            amountDue: null,
            amountApplied: null,
            postMaturityLoanCount,
            incompleteScheduleLoanCount: 0,
          });
        }
      }
    }
    const loansByMember = new Map<string, Omit<Loan, 'borrower'>[]>();

    for (const loan of loans) {
      const memberId = loan.borrower.id;
      const { borrower, ...serializedLoan } = loan;
      void borrower;
      const memberLoans = loansByMember.get(memberId) ?? [];
      memberLoans.push(serializedLoan);
      loansByMember.set(memberId, memberLoans);
    }

    return members.map((member) => {
      const memberLoans = loansByMember.get(member.id) ?? [];

      const totalLoanAmount = memberLoans
        .filter((loan) => loan.status === 'active')
        .reduce((sum, loan) => sum + Number(loan.principalAmount), 0);
      const totalBalance = memberLoans
        .filter((loan) => loan.status === 'active')
        .reduce((sum, loan) => sum + Number(loan.balance), 0);

      // Calculate overall amount (principal + interest) - only for active loans
      const overallAmount = memberLoans
        .filter((loan) => loan.status === 'active')
        .reduce((sum, loan) => sum + Number(loan.totalAmount), 0);

      // Calculate weekly payment amount (sum of all active loans' weekly payments)
      const weeklyPaymentAmount = memberLoans
        .filter((loan) => loan.status === 'active')
        .reduce((sum, loan) => sum + Number(loan.weeklyPaymentAmount), 0);

      // Calculate total term weeks (sum of all active loans' terms)
      const totalTermWeeks = memberLoans
        .filter((loan) => loan.status === 'active')
        .reduce((sum, loan) => sum + Number(loan.termWeeks), 0);

      // Savings displayed in collections view should reflect the active loan's savings balance only
      const activeLoanSavings =
        memberLoans.find((loan) => loan.status === 'active')?.savings ?? 0;
      const totalSavings = Number(activeLoanSavings) || 0;

      // Sum of net cash released across active loans only (reloans)
      const netCashReleased = memberLoans
        .filter((loan) => loan.status === 'active')
        .reduce((sum, loan) => sum + Number(loan.netCashReleased || 0), 0);

      return {
        ...member,
        loans: memberLoans,
        totalLoanAmount,
        totalBalance,
        overallAmount,
        weeklyPaymentAmount,
        totalTermWeeks,
        totalSavings,
        netCashReleased,
        ...(date
          ? {
              weeklyPaid: weeklyFundingByMember.get(member.id)?.paid ?? null,
              weeklyHasAllocation:
                weeklyFundingByMember.get(member.id)?.hasAllocation ?? null,
              weeklyAmountDue:
                weeklyFundingByMember.get(member.id)?.amountDue ?? null,
              weeklyAmountApplied:
                weeklyFundingByMember.get(member.id)?.amountApplied ?? null,
              weeklyFinancial: weeklyFinancialByMember.get(member.id) ?? {
                kind: 'missing_schedule_unexpectedly',
                amountDue: null,
                amountApplied: null,
                postMaturityLoanCount: 0,
                incompleteScheduleLoanCount: activeLoans.filter(
                  (loan) => loan.borrower.id === member.id,
                ).length,
              },
              loanCondition: loanConditionByMember.get(member.id) ?? {
                status: 'indeterminate',
              },
            }
          : {}),
      };
    });
  }

  private async loadStableReleaseDates(
    loanIds: string[],
  ): Promise<Map<string, string>> {
    if (loanIds.length === 0) return new Map();

    const rows = await this.loanRepository.query<
      Array<{ loanId: string; releaseDate: string | null }>
    >(
      `SELECT id AS "loanId",
              COALESCE("loanCreatedDate", "createdAt")::date::text AS "releaseDate"
         FROM loan
        WHERE id = ANY($1::uuid[])`,
      [loanIds],
    );

    return new Map(
      rows.flatMap(({ loanId, releaseDate }) => {
        if (!releaseDate) return [];
        try {
          return [[loanId, parseDateOnly(releaseDate).value] as const];
        } catch {
          return [];
        }
      }),
    );
  }

  private async loadLegacySavingsDebits(
    repayments: Repayment[],
  ): Promise<Savings[]> {
    if (repayments.length === 0) return [];
    const repaymentIds = repayments.map(({ id }) => id);
    return this.savingsRepository.find({
      where: [
        {
          eventType: SavingsEventType.REPAYMENT_DEBIT,
          referenceId: In(repaymentIds),
        },
        {
          eventType: SavingsEventType.REPAYMENT_DEBIT,
          idempotencyKey: In(
            repaymentIds.map(repaymentSavingsDebitIdempotencyKey),
          ),
        },
      ],
    });
  }

  private classifyWeeklyFinancialState(
    loan: Loan,
    schedules: LoanRepaymentSchedule[],
    repayments: Repayment[],
    savingsDebits: Savings[],
    stableReleaseDate: string | null,
    collectionDay: string | undefined,
    selectedDate: string,
    weekStart: string,
    weekEnd: string,
  ): LoanWeeklyFinancialProjection {
    const expectedCount = Number(loan.termWeeks || 0);
    const ordered = [...schedules].sort(
      (left, right) => left.weekNumber - right.weekNumber,
    );

    if (ordered.length === 0) {
      return this.classifyLegacyWeeklyFinancialState(
        loan,
        repayments,
        savingsDebits,
        stableReleaseDate,
        collectionDay,
        selectedDate,
        weekStart,
        weekEnd,
      );
    }

    if (
      expectedCount <= 0 ||
      ordered.length !== expectedCount ||
      !this.hasValidContractualSchedule(ordered, expectedCount)
    ) {
      return {
        kind: 'missing_schedule_unexpectedly',
        amountDue: null,
        amountApplied: null,
      };
    }

    const selectedSchedules = ordered.filter(
      (schedule) =>
        schedule.dueDate >= weekStart && schedule.dueDate <= weekEnd,
    );
    if (selectedSchedules.length > 1) {
      return {
        kind: 'missing_schedule_unexpectedly',
        amountDue: null,
        amountApplied: null,
      };
    }
    if (selectedSchedules.length === 1) {
      const schedule = selectedSchedules[0];
      return {
        kind: 'scheduled_week',
        amountDue: Number(schedule.amountDue),
        amountApplied: this.sumEffectiveScheduleAllocations(schedule),
      };
    }

    const firstDueDate = ordered[0].dueDate;
    const finalDueDate = ordered[ordered.length - 1].dueDate;
    if (weekEnd < firstDueDate) {
      return {
        kind: 'pre_first_due_no_weekly_obligation',
        amountDue: null,
        amountApplied: null,
      };
    }
    if (weekStart > finalDueDate) {
      return {
        kind: 'post_maturity_no_weekly_obligation',
        amountDue: null,
        amountApplied: null,
      };
    }

    return {
      kind: 'missing_schedule_unexpectedly',
      amountDue: null,
      amountApplied: null,
    };
  }

  private classifyLegacyWeeklyFinancialState(
    loan: Loan,
    repayments: Repayment[],
    savingsDebits: Savings[],
    stableReleaseDate: string | null,
    collectionDay: string | undefined,
    selectedDate: string,
    weekStart: string,
    weekEnd: string,
  ): LoanWeeklyFinancialProjection {
    if (
      loan.status !== 'active' ||
      loan.overdueChargePolicyVersion !== null ||
      loan.overdueChargePolicyEffectiveDate !== null ||
      !stableReleaseDate ||
      !Number.isInteger(Number(loan.termWeeks)) ||
      Number(loan.termWeeks) <= 0 ||
      !Number.isFinite(Number(loan.weeklyPaymentAmount)) ||
      Number(loan.weeklyPaymentAmount) <= 0 ||
      !Number.isFinite(Number(loan.totalAmount)) ||
      Number(loan.totalAmount) <= 0
    ) {
      return {
        kind: 'missing_schedule_unexpectedly',
        amountDue: null,
        amountApplied: null,
      };
    }

    const installments = this.buildSyntheticInstallments(
      loan,
      stableReleaseDate,
      collectionDay,
    );
    if (!installments) {
      return {
        kind: 'missing_schedule_unexpectedly',
        amountDue: null,
        amountApplied: null,
      };
    }

    const selectedIndexes = installments.flatMap((installment, index) =>
      installment.dueDate >= weekStart && installment.dueDate <= weekEnd
        ? [index]
        : [],
    );
    if (selectedIndexes.length > 1) {
      return {
        kind: 'missing_schedule_unexpectedly',
        amountDue: null,
        amountApplied: null,
      };
    }
    if (selectedIndexes.length === 0) {
      if (weekEnd < installments[0].dueDate) {
        return {
          kind: 'pre_first_due_no_weekly_obligation',
          amountDue: null,
          amountApplied: null,
        };
      }
      if (weekStart > installments[installments.length - 1].dueDate) {
        return {
          kind: 'post_maturity_no_weekly_obligation',
          amountDue: null,
          amountApplied: null,
        };
      }
      return {
        kind: 'missing_schedule_unexpectedly',
        amountDue: null,
        amountApplied: null,
      };
    }

    const appliedByInstallment = this.replayLegacyFunding(
      installments,
      repayments,
      savingsDebits,
      selectedDate,
    );
    if (!appliedByInstallment) {
      return {
        kind: 'historical_funding_unavailable',
        amountDue: null,
        amountApplied: null,
      };
    }

    const selectedIndex = selectedIndexes[0];
    return {
      kind: 'scheduled_week',
      amountDue: installments[selectedIndex].amountDueCents / 100,
      amountApplied: appliedByInstallment[selectedIndex] / 100,
    };
  }

  private buildSyntheticInstallments(
    loan: Loan,
    stableReleaseDate: string,
    collectionDay: string | undefined,
  ): SyntheticInstallment[] | null {
    const dueDates = buildContractualDueDates({
      releaseDate: stableReleaseDate,
      collectionDay,
      termWeeks: Number(loan.termWeeks),
      weeklyPaymentAmount: Number(loan.weeklyPaymentAmount),
    });
    const breakdown = buildLoanRepaymentBreakdown(loan);
    if (!dueDates || breakdown.length !== dueDates.length) return null;

    const installments = dueDates.map((dueDate, index) => ({
      dueDate,
      amountDueCents: Math.round(Number(breakdown[index]?.amountDue) * 100),
    }));
    return installments.every(
      ({ amountDueCents }) =>
        Number.isFinite(amountDueCents) && amountDueCents > 0,
    )
      ? installments
      : null;
  }

  private replayLegacyFunding(
    installments: SyntheticInstallment[],
    repayments: Repayment[],
    savingsDebits: Savings[],
    selectedDate: string,
  ): number[] | null {
    const paymentsById = new Map(
      repayments
        .filter(
          (repayment) =>
            repayment.operationType === RepaymentOperationType.PAYMENT,
        )
        .map((repayment) => [repayment.id, repayment]),
    );
    const reversalByPaymentId = new Map<string, Repayment>();

    for (const reversal of repayments) {
      if (reversal.operationType !== RepaymentOperationType.REVERSAL) continue;
      const reversalDate = this.getRepaymentBusinessDate(reversal);
      const original = reversal.relatedRepaymentId
        ? paymentsById.get(reversal.relatedRepaymentId)
        : undefined;
      if (
        !original ||
        !reversal.relatedRepaymentId ||
        !reversalDate ||
        reversalByPaymentId.has(reversal.relatedRepaymentId)
      ) {
        return null;
      }
      const originalDate = this.getRepaymentBusinessDate(original);
      if (!originalDate || reversalDate < originalDate) return null;
      reversalByPaymentId.set(reversal.relatedRepaymentId, reversal);
    }

    const effectivePayments: Array<{
      repayment: Repayment;
      businessDate: string;
      contractualCents: number;
    }> = [];
    for (const repayment of paymentsById.values()) {
      const businessDate = this.getRepaymentBusinessDate(repayment);
      if (!businessDate) return null;
      if (businessDate > selectedDate) continue;

      const reversal = reversalByPaymentId.get(repayment.id);
      if (reversal) {
        const reversalDate = this.getRepaymentBusinessDate(reversal);
        if (!reversalDate) return null;
        if (reversalDate <= selectedDate) continue;
      }

      const contractualCents = this.resolveLegacyContractualCents(
        repayment,
        savingsDebits,
      );
      if (contractualCents === null) return null;
      effectivePayments.push({ repayment, businessDate, contractualCents });
    }

    effectivePayments.sort(
      (left, right) =>
        left.businessDate.localeCompare(right.businessDate) ||
        (left.repayment.createdAt?.getTime() ?? 0) -
          (right.repayment.createdAt?.getTime() ?? 0) ||
        left.repayment.id.localeCompare(right.repayment.id),
    );

    const applied = installments.map(() => 0);
    for (const payment of effectivePayments) {
      let remaining = payment.contractualCents;
      for (
        let index = 0;
        index < installments.length && remaining > 0;
        index++
      ) {
        const shortfall = Math.max(
          0,
          installments[index].amountDueCents - applied[index],
        );
        const amount = Math.min(shortfall, remaining);
        applied[index] += amount;
        remaining -= amount;
      }
      if (remaining > 0 && applied.length > 0) {
        applied[applied.length - 1] += remaining;
      }
    }
    return applied;
  }

  private resolveLegacyContractualCents(
    repayment: Repayment,
    savingsDebits: Savings[],
  ): number | null {
    const cashCents = Math.round(Number(repayment.amount) * 100);
    if (!Number.isFinite(cashCents) || cashCents < 0) return null;

    const expectedKey = repaymentSavingsDebitIdempotencyKey(repayment.id);
    const matchingDebits = savingsDebits.filter(
      (entry) =>
        entry.referenceId === repayment.id ||
        entry.idempotencyKey === expectedKey,
    );
    if (matchingDebits.length > 1) return null;
    if (repayment.useSavings && matchingDebits.length !== 1) return null;
    if (matchingDebits.length === 0) return cashCents;

    const savingsCents = Math.round(
      Math.abs(Number(matchingDebits[0].amount)) * 100,
    );
    return Number.isFinite(savingsCents) ? cashCents + savingsCents : null;
  }

  private getRepaymentBusinessDate(repayment: Repayment): string | null {
    const value = repayment.paymentDate ?? repayment.collectionDate;
    if (!value) return null;
    try {
      return parseDateOnly(value).value;
    } catch {
      return null;
    }
  }

  private hasValidContractualSchedule(
    schedules: LoanRepaymentSchedule[],
    expectedCount: number,
  ): boolean {
    try {
      return (
        schedules.every((schedule, index) => {
          if (
            schedule.weekNumber !== index + 1 ||
            !Number.isFinite(Number(schedule.amountDue)) ||
            Number(schedule.amountDue) <= 0
          ) {
            return false;
          }
          const dueDate = parseDateOnly(schedule.dueDate).value;
          if (index === 0) return true;
          return (
            dueDate ===
            addDaysToDateOnly(parseDateOnly(schedules[index - 1].dueDate), 7)
          );
        }) && schedules.length === expectedCount
      );
    } catch {
      return false;
    }
  }

  private sumEffectiveScheduleAllocations(
    schedule: LoanRepaymentSchedule,
  ): number {
    const cents = (schedule.allocations ?? []).reduce(
      (sum, allocation) =>
        allocation.repayment?.status === RepaymentStatus.APPROVED &&
        allocation.repayment.operationType === RepaymentOperationType.PAYMENT
          ? sum + Math.round(Number(allocation.amountApplied) * 100)
          : sum,
      0,
    );
    return cents / 100;
  }

  private classifyLoanCondition(
    loan: Loan,
    schedules: LoanRepaymentSchedule[],
    repayments: Repayment[],
    collectionDay: string | undefined,
    stableReleaseDate: string | null,
    selectedDate: string,
    selectedWeekStart: string,
  ): LoanConditionProjection {
    if (this.hasIndeterminateHistoricalReversal(repayments, selectedDate)) {
      return { status: 'indeterminate' };
    }

    if (schedules.length === 0) {
      return this.classifyLegacyZeroScheduleLoan(
        loan,
        repayments,
        collectionDay,
        stableReleaseDate,
        selectedDate,
        selectedWeekStart,
      );
    }

    const expectedCount = Number(loan.termWeeks || 0);
    const ordered = [...schedules].sort(
      (left, right) => left.weekNumber - right.weekNumber,
    );
    if (!this.hasValidContractualSchedule(ordered, expectedCount)) {
      return { status: 'indeterminate' };
    }

    const projectedSchedules: Array<{
      dueDate: string;
      outstandingCents: number;
    }> = [];
    for (const schedule of ordered) {
      const applied = this.sumScheduleAllocationsAsOf(schedule, selectedDate);
      if (applied === null) return { status: 'indeterminate' };
      projectedSchedules.push({
        dueDate: schedule.dueDate,
        outstandingCents: Math.max(
          0,
          Math.round(Number(schedule.amountDue) * 100) - applied,
        ),
      });
    }

    return this.resolveLoanCondition(
      projectedSchedules,
      selectedDate,
      selectedWeekStart,
    );
  }

  private classifyLegacyZeroScheduleLoan(
    loan: Loan,
    repayments: Repayment[],
    collectionDay: string | undefined,
    stableReleaseDate: string | null,
    selectedDate: string,
    selectedWeekStart: string,
  ): LoanConditionProjection {
    if (
      loan.overdueChargePolicyVersion !== null ||
      loan.overdueChargePolicyEffectiveDate !== null
    ) {
      return { status: 'indeterminate' };
    }

    for (const repayment of repayments) {
      if (repayment.operationType !== RepaymentOperationType.PAYMENT) continue;
      const businessDate = repayment.paymentDate ?? repayment.collectionDate;
      if (!businessDate || businessDate <= selectedDate) {
        return { status: 'indeterminate' };
      }
    }

    if (!stableReleaseDate) return { status: 'indeterminate' };
    const installments = this.buildSyntheticInstallments(
      loan,
      stableReleaseDate,
      collectionDay,
    );
    if (!installments) {
      return { status: 'indeterminate' };
    }

    return this.resolveLoanCondition(
      installments.map((installment) => ({
        dueDate: installment.dueDate,
        outstandingCents: installment.amountDueCents,
      })),
      selectedDate,
      selectedWeekStart,
    );
  }

  private resolveLoanCondition(
    schedules: Array<{ dueDate: string; outstandingCents: number }>,
    selectedDate: string,
    selectedWeekStart: string,
  ): LoanConditionProjection {
    const finalDueDate = schedules[schedules.length - 1]?.dueDate;
    if (!finalDueDate) return { status: 'indeterminate' };

    const totalOutstanding = schedules.reduce(
      (sum, schedule) => sum + schedule.outstandingCents,
      0,
    );
    if (selectedDate > finalDueDate && totalOutstanding > 0) {
      return { status: 'past_maturity' };
    }
    if (
      selectedDate <= finalDueDate &&
      schedules.some(
        (schedule) =>
          schedule.dueDate < selectedWeekStart && schedule.outstandingCents > 0,
      )
    ) {
      return { status: 'past_due' };
    }
    return { status: 'normal' };
  }

  private sumScheduleAllocationsAsOf(
    schedule: LoanRepaymentSchedule,
    selectedDate: string,
  ): number | null {
    let cents = 0;
    for (const allocation of schedule.allocations ?? []) {
      const repayment = allocation.repayment;
      if (
        repayment?.status !== RepaymentStatus.APPROVED ||
        repayment.operationType !== RepaymentOperationType.PAYMENT
      ) {
        continue;
      }
      const businessDate = repayment.paymentDate ?? repayment.collectionDate;
      if (!businessDate) return null;
      if (businessDate <= selectedDate) {
        cents += Math.round(Number(allocation.amountApplied) * 100);
      }
    }
    return cents;
  }

  private hasIndeterminateHistoricalReversal(
    repayments: Repayment[],
    selectedDate: string,
  ): boolean {
    const byId = new Map(
      repayments.map((repayment) => [repayment.id, repayment]),
    );
    return repayments.some((reversal) => {
      if (
        reversal.operationType !== RepaymentOperationType.REVERSAL ||
        !reversal.relatedRepaymentId
      ) {
        return false;
      }
      const original = byId.get(reversal.relatedRepaymentId);
      const originalDate = original?.paymentDate ?? original?.collectionDate;
      const reversalDate = reversal.paymentDate ?? reversal.collectionDate;
      if (!original || !originalDate || !reversalDate) return true;
      return originalDate <= selectedDate && reversalDate > selectedDate;
    });
  }
}
