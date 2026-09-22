import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Not, Repository } from 'typeorm';
import {
  Repayment,
  RepaymentOperationType,
  RepaymentStatus,
} from './repayment.entity';
import { Loan } from '../loans/loan.entity';
import { Member } from '../members/entities/member.entity';
import { Center } from '../centers/entities/center.entity';
import {
  AdvancePaymentStatus,
  Collection,
} from '../collections/entities/collection.entity';
import { LoansService } from '../loans/loans.service';
import {
  LoanRepaymentSchedule,
  LoanRepaymentStatus,
} from './entities/loan-repayment-schedule.entity';
import { LoanRepaymentAllocation } from './entities/loan-repayment-allocation.entity';
import { buildLoanRepaymentBreakdown } from './loan-repayment-schedule.utils';
import { getRealizedAllocationSplit } from './loan-repayment-allocation.utils';
import { Savings, SavingsEventType } from '../savings/savings.entity';
import {
  CollectionBatch,
  CollectionBatchStatus,
} from './entities/collection-batch.entity';
import { getFinancialBusinessDate } from '../common/financial-business-date';
import {
  repaymentSavingsDebitIdempotencyKey,
  repaymentSavingsReversalIdempotencyKey,
  SAVINGS_REFERENCE_TYPE,
} from '../savings/savings-ledger.utils';
import { LoanChargesService } from '../loans/loan-charges.service';

export interface PendingRepaymentCollectionGroup {
  batchId: string | null;
  centerId: string;
  centerName: string;
  collectionDate: string;
  pendingCount: number;
  paymentCount: number;
  reversalCount: number;
  paymentAmount: number;
  reversalAmount: number;
  netAmount: number;
}

export interface PendingCollectionActionResult {
  batchId?: string | null;
  centerId: string;
  collectionDate: string;
  processedCount: number;
  approvedCount?: number;
  rejectedCount?: number;
  approvedPaymentIds?: string[];
}

export interface RepaymentScheduleRepairSummary {
  loansScanned: number;
  loansRepaired: number;
  schedulesCreated: number;
  allocationsDeleted: number;
  approvedRepaymentsReplayed: number;
}

export interface RepaymentAllocationPreview {
  repaymentId: string;
  loanId: string;
  asOfDate: string;
  allocation: ReturnType<LoanChargesService['previewPaymentAllocation']>;
}

@Injectable()
export class RepaymentsService implements OnModuleInit {
  constructor(
    @InjectRepository(Repayment)
    private readonly repaymentRepo: Repository<Repayment>,
    @InjectRepository(Loan)
    private readonly loanRepo: Repository<Loan>,
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
    @InjectRepository(Center)
    private readonly centerRepo: Repository<Center>,
    @InjectRepository(Collection)
    private readonly collectionRepo: Repository<Collection>,
    @InjectRepository(LoanRepaymentSchedule)
    private readonly scheduleRepo: Repository<LoanRepaymentSchedule>,
    @InjectRepository(LoanRepaymentAllocation)
    private readonly allocationRepo: Repository<LoanRepaymentAllocation>,
    @InjectRepository(Savings)
    private readonly savingsRepo: Repository<Savings>,
    @InjectRepository(CollectionBatch)
    private readonly collectionBatchRepo: Repository<CollectionBatch>,
    private readonly loansService: LoansService,
    private readonly loanChargesService: LoanChargesService,
  ) {}

  async onModuleInit(): Promise<void> {
    const existingSchedules = await this.scheduleRepo.count();
    if (existingSchedules > 0) {
      return;
    }

    const loans = await this.loanRepo.find({
      relations: ['borrower', 'borrower.center'],
    });

    for (const loan of loans) {
      const borrower = loan.borrower;
      if (!borrower) continue;
      const center = borrower.center ?? null;
      await this.ensureLoanSchedule(loan, borrower, center);
      await this.replayExistingRepayments(loan, borrower, center);
    }
  }

  async repairExistingRepaymentSchedules(
    onProgress?: (message: string) => void,
  ): Promise<RepaymentScheduleRepairSummary> {
    const loans = await this.loanRepo.find({
      relations: ['borrower', 'borrower.center'],
      order: { createdAt: 'ASC' },
    });

    const summary: RepaymentScheduleRepairSummary = {
      loansScanned: loans.length,
      loansRepaired: 0,
      schedulesCreated: 0,
      allocationsDeleted: 0,
      approvedRepaymentsReplayed: 0,
    };

    for (const [index, loan] of loans.entries()) {
      const borrower = loan.borrower;
      if (!borrower) {
        continue;
      }

      const center = borrower.center ?? null;
      const schedulesBefore = await this.scheduleRepo.find({
        where: { loanId: loan.id },
      });
      const scheduleCountBefore = schedulesBefore.length;

      const approvedEntries = await this.repaymentRepo.find({
        where: { loan: { id: loan.id }, status: RepaymentStatus.APPROVED },
        relations: ['loan'],
        order: { createdAt: 'ASC' },
      });

      const deletedAllocations = schedulesBefore.length
        ? await this.allocationRepo.count({
            where: {
              scheduleId: In(schedulesBefore.map((schedule) => schedule.id)),
            },
          })
        : 0;

      onProgress?.(
        `Repairing loan ${index + 1}/${loans.length}: ${loan.id} (${approvedEntries.length} approved repayments)`,
      );

      await this.ensureLoanSchedule(loan, borrower, center);
      await this.replayExistingRepayments(loan, borrower, center);

      const scheduleCountAfter = await this.scheduleRepo.count({
        where: { loanId: loan.id },
      });
      const reversedRepaymentIds = new Set(
        approvedEntries
          .filter(
            (entry) =>
              entry.operationType === RepaymentOperationType.REVERSAL &&
              Boolean(entry.relatedRepaymentId),
          )
          .map((entry) => entry.relatedRepaymentId as string),
      );

      summary.loansRepaired += 1;
      summary.schedulesCreated += Math.max(
        0,
        scheduleCountAfter - scheduleCountBefore,
      );
      summary.allocationsDeleted += deletedAllocations;
      summary.approvedRepaymentsReplayed += approvedEntries.filter(
        (entry) =>
          entry.operationType !== RepaymentOperationType.REVERSAL &&
          !reversedRepaymentIds.has(entry.id),
      ).length;
    }

    return summary;
  }

  private normalizeCollectionDate(collectionDate?: string): string {
    if (collectionDate) {
      const parsed = new Date(collectionDate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }

  private async ensurePendingCollectionBatch(
    centerId: string,
    collectionDate: string,
    submittedById?: string | null,
  ): Promise<CollectionBatch> {
    const existing = await this.collectionBatchRepo.findOne({
      where: {
        centerId,
        collectionDate,
        status: CollectionBatchStatus.PENDING,
      },
    });

    if (existing) {
      return existing;
    }

    const created = this.collectionBatchRepo.create({
      centerId,
      collectionDate,
      status: CollectionBatchStatus.PENDING,
      submittedById: submittedById ?? null,
      submittedAt: new Date(),
    });

    try {
      return await this.collectionBatchRepo.save(created);
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const current = await this.collectionBatchRepo.findOne({
        where: {
          centerId,
          collectionDate,
          status: CollectionBatchStatus.PENDING,
        },
      });

      if (!current) {
        throw error;
      }

      return current;
    }
  }

  async create(
    body: {
      loanId: string;
      memberId: string;
      centerId: string;
      amount: number;
      collectionDate?: string;
      notes?: string;
      useSavings?: boolean;
    },
    actor?: { userId?: string; role?: string },
  ) {
    const {
      loanId,
      memberId,
      centerId,
      amount,
      collectionDate,
      notes,
      useSavings = false,
    } = body;

    if (
      amount === undefined ||
      amount === null ||
      Number.isNaN(Number(amount))
    ) {
      throw new BadRequestException('Amount must be provided as a number');
    }

    const numericAmount = Number(amount);
    if (numericAmount < 0) {
      throw new BadRequestException('Amount must be >= 0');
    }

    if (numericAmount === 0 && !useSavings) {
      throw new BadRequestException(
        'Amount must be > 0 when not using savings to cover the payment',
      );
    }

    const [loan, member, center] = await Promise.all([
      this.loanRepo.findOne({
        where: { id: loanId },
        relations: ['borrower', 'borrower.center'],
      }),
      this.memberRepo.findOne({
        where: { id: memberId },
        relations: ['center'],
      }),
      this.centerRepo.findOne({ where: { id: centerId } }),
    ]);

    if (!loan) throw new NotFoundException('Loan not found');
    if (!member) throw new NotFoundException('Member not found');
    if (!center) throw new NotFoundException('Center not found');

    if (loan.status !== 'active') {
      throw new BadRequestException(
        'Cannot post payment for a non-active loan',
      );
    }

    if (loan.borrower?.id !== member.id) {
      throw new BadRequestException('Loan does not belong to the member');
    }

    if (member.center?.id !== center.id) {
      throw new BadRequestException('Member does not belong to the center');
    }

    const activeLoans = await this.loanRepo.find({
      where: { borrower: { id: member.id }, status: 'active' },
    });
    if (activeLoans.length > 1) {
      throw new BadRequestException(
        'Member has multiple active loans. Resolve loan records before posting payment',
      );
    }

    if (activeLoans.length !== 1 || activeLoans[0].id !== loan.id) {
      throw new BadRequestException(
        'Submitted loan is not the member active loan',
      );
    }

    const collectionDateString = this.normalizeCollectionDate(collectionDate);
    const createdById = actor?.userId ?? null;
    const shouldAutoApprove =
      actor?.role === 'manager' || actor?.role === 'admin';
    const pendingBatch = shouldAutoApprove
      ? null
      : await this.ensurePendingCollectionBatch(
          center.id,
          collectionDateString,
          createdById,
        );

    const repayment = this.repaymentRepo.create({
      loan,
      member,
      center,
      amount: numericAmount,
      notes,
      paymentDate: collectionDateString,
      collectionDate: collectionDateString,
      useSavings: Boolean(useSavings),
      status: RepaymentStatus.PENDING,
      operationType: RepaymentOperationType.PAYMENT,
      relatedRepaymentId: null,
      batchId: pendingBatch?.id ?? null,
      createdById,
    });
    const savedRepayment = await this.repaymentRepo.save(repayment);

    if (!shouldAutoApprove) {
      return savedRepayment;
    }

    return this.approveRepayment(savedRepayment.id, createdById ?? undefined);
  }

  async requestReversal(
    repaymentId: string,
    body: { reason?: string },
    actor?: { userId?: string; role?: string },
  ) {
    const sourceRepayment = await this.repaymentRepo.findOne({
      where: { id: repaymentId },
      relations: ['loan', 'member', 'center'],
    });

    if (!sourceRepayment) {
      throw new NotFoundException('Repayment not found');
    }

    if (sourceRepayment.operationType === RepaymentOperationType.REVERSAL) {
      throw new BadRequestException('Cannot reverse a reversal transaction');
    }

    if (sourceRepayment.status !== RepaymentStatus.APPROVED) {
      throw new BadRequestException('Only approved repayments can be reversed');
    }

    const existingReversal = await this.repaymentRepo.findOne({
      where: {
        relatedRepaymentId: sourceRepayment.id,
        operationType: RepaymentOperationType.REVERSAL,
        status: In([RepaymentStatus.PENDING, RepaymentStatus.APPROVED]),
      },
      order: { createdAt: 'DESC' },
    });

    if (existingReversal) {
      if (existingReversal.status === RepaymentStatus.PENDING) {
        throw new BadRequestException(
          'A reversal request is already pending approval',
        );
      }
      throw new BadRequestException('Repayment has already been reversed');
    }

    const createdById = actor?.userId ?? null;
    const shouldAutoApprove =
      actor?.role === 'manager' || actor?.role === 'admin';
    const reason = body.reason?.trim();
    const sourceCenterId = sourceRepayment.center?.id;
    if (!sourceCenterId) {
      throw new NotFoundException('Center not found');
    }
    const reversalCollectionDate =
      sourceRepayment.collectionDate ??
      this.normalizeCollectionDate(sourceRepayment.createdAt.toISOString());
    const pendingBatch = shouldAutoApprove
      ? null
      : await this.ensurePendingCollectionBatch(
          sourceCenterId,
          reversalCollectionDate,
          createdById,
        );

    const reversal = this.repaymentRepo.create({
      loan: sourceRepayment.loan,
      member: sourceRepayment.member,
      center: sourceRepayment.center,
      amount: Number(sourceRepayment.amount),
      notes:
        reason && reason.length > 0
          ? reason
          : `Reversal request for repayment ${sourceRepayment.id}`,
      collectionDate: reversalCollectionDate,
      useSavings: false,
      status: RepaymentStatus.PENDING,
      operationType: RepaymentOperationType.REVERSAL,
      relatedRepaymentId: sourceRepayment.id,
      batchId: pendingBatch?.id ?? null,
      createdById,
    });

    const savedReversal = await this.repaymentRepo.save(reversal);

    if (!shouldAutoApprove) {
      return savedReversal;
    }

    return this.approveRepayment(savedReversal.id, createdById ?? undefined);
  }

  private parseDate(date: string): Date {
    const [year, month, day] = date.split('-').map((value) => Number(value));
    return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  }

  private addDays(date: Date, days: number): Date {
    const clone = new Date(date.getTime());
    clone.setUTCDate(clone.getUTCDate() + days);
    return clone;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private getWeekdayIndex(day: string | null | undefined): number {
    if (!day) return -1;
    const lookup: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    return lookup[day.toLowerCase()] ?? -1;
  }

  private normalizeDate(input: Date | string | null | undefined): Date {
    const raw =
      typeof input === 'string'
        ? new Date(input)
        : input instanceof Date
          ? new Date(input.getTime())
          : new Date();
    return new Date(
      Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()),
    );
  }

  private computeFirstDueDate(
    loan: Loan,
    member: Member | null,
    center: Center | null,
  ): Date {
    const baseDate = this.normalizeDate(
      loan.loanCreatedDate ?? loan.createdAt ?? new Date(),
    );
    const collectionDay =
      center?.collectionDay ?? member?.center?.collectionDay ?? null;
    const targetIndex = this.getWeekdayIndex(collectionDay);
    if (targetIndex < 0) {
      return baseDate;
    }
    const currentIndex = baseDate.getUTCDay();
    let delta = (targetIndex - currentIndex + 7) % 7;
    // If the loan is created on the collection day, push first due date to the next week
    if (delta === 0) {
      delta = 7;
    }
    return this.addDays(baseDate, delta);
  }

  private async ensureLoanSchedule(
    loan: Loan,
    member: Member,
    center: Center | null,
    manager?: EntityManager,
  ): Promise<void> {
    const scheduleRepository =
      manager?.getRepository(LoanRepaymentSchedule) ?? this.scheduleRepo;
    const existingRows = await scheduleRepository.find({
      where: { loanId: loan.id },
      order: { weekNumber: 'ASC' },
    });
    if (existingRows.length > 0) {
      const breakdown = buildLoanRepaymentBreakdown(loan);
      const needsBreakdownBackfill = existingRows.some(
        (schedule, index) =>
          Number(schedule.principalDue || 0) !==
            Number(breakdown[index]?.principalDue ?? 0) ||
          Number(schedule.interestDue || 0) !==
            Number(
              (
                Number(schedule.amountDue || 0) -
                Number(breakdown[index]?.principalDue ?? 0)
              ).toFixed(2),
            ),
      );

      if (needsBreakdownBackfill && breakdown.length === existingRows.length) {
        await scheduleRepository.save(
          existingRows.map((schedule, index) => ({
            ...schedule,
            principalDue: breakdown[index]?.principalDue ?? 0,
            interestDue: Number(
              (
                Number(schedule.amountDue || 0) -
                Number(breakdown[index]?.principalDue ?? 0)
              ).toFixed(2),
            ),
          })),
        );
      }
      return;
    }

    const termWeeks = Number(loan.termWeeks || 0);
    const weeklyDue = Number(loan.weeklyPaymentAmount || 0);
    if (termWeeks <= 0 || weeklyDue <= 0) {
      return;
    }

    const firstDueDate = this.computeFirstDueDate(loan, member, center);
    const memberId = loan.borrower?.id ?? member.id;
    const centerId =
      center?.id ?? loan.borrower?.center?.id ?? member.center?.id ?? null;
    const breakdown = buildLoanRepaymentBreakdown(loan);

    const rows: LoanRepaymentSchedule[] = [];
    for (let i = 0; i < termWeeks; i += 1) {
      const dueDate = this.formatDate(this.addDays(firstDueDate, i * 7));
      const scheduleBreakdown = breakdown[i];
      const schedule = scheduleRepository.create({
        loanId: loan.id,
        memberId: memberId ?? null,
        centerId: centerId ?? null,
        weekNumber: i + 1,
        dueDate,
        amountDue: scheduleBreakdown?.amountDue ?? weeklyDue,
        principalDue: scheduleBreakdown?.principalDue ?? 0,
        interestDue:
          scheduleBreakdown?.interestDue ?? Math.max(0, Number(weeklyDue || 0)),
        amountPaid: 0,
        status: LoanRepaymentStatus.UNPAID,
        advanceApplied: 0,
      });
      rows.push(schedule);
    }
    await scheduleRepository.save(rows);
  }

  private resolveScheduleStatus(
    schedule: LoanRepaymentSchedule,
    paymentDate: Date,
  ): LoanRepaymentStatus {
    const epsilon = 0.01;
    const dueAmount = Number(schedule.amountDue || 0);
    const paidAmount = Number(schedule.amountPaid || 0);
    if (paidAmount >= dueAmount - epsilon) {
      const dueDate = new Date(`${schedule.dueDate}T00:00:00Z`);
      if (dueDate.getTime() > paymentDate.getTime()) {
        return LoanRepaymentStatus.ADVANCE;
      }
      return LoanRepaymentStatus.PAID;
    }
    if (paidAmount > epsilon) {
      return LoanRepaymentStatus.PARTIAL;
    }
    return LoanRepaymentStatus.UNPAID;
  }

  private async applyRepaymentToSchedule(
    params: {
      loan: Loan;
      member: Member;
      center: Center | null;
      repayment: Repayment;
      allocationAmount: number;
      cashPortion: number;
      savingsPortion: number;
      paymentDate: string | null;
    },
    manager?: EntityManager,
  ): Promise<void> {
    const {
      loan,
      member,
      center,
      repayment,
      allocationAmount,
      cashPortion,
      savingsPortion,
      paymentDate,
    } = params;

    const epsilon = 0.01;
    if (allocationAmount <= epsilon) {
      return;
    }

    const scheduleRepository =
      manager?.getRepository(LoanRepaymentSchedule) ?? this.scheduleRepo;
    const allocationRepository =
      manager?.getRepository(LoanRepaymentAllocation) ?? this.allocationRepo;
    await this.ensureLoanSchedule(loan, member, center, manager);

    const schedules = await scheduleRepository.find({
      where: { loanId: loan.id },
      order: { dueDate: 'ASC', weekNumber: 'ASC' },
    });

    let remaining = allocationAmount;
    let cashRemaining = Math.max(0, cashPortion);
    let savingsRemaining = Math.max(0, savingsPortion);
    const touched = new Map<string, LoanRepaymentSchedule>();
    const allocations = new Map<string, LoanRepaymentAllocation>();

    for (const schedule of schedules) {
      const due = Number(schedule.amountDue || 0);
      const paid = Number(schedule.amountPaid || 0);
      const shortfall = Math.max(0, due - paid);
      if (shortfall <= epsilon || remaining <= epsilon) {
        continue;
      }
      const applied = Math.min(shortfall, remaining);
      const cashApplied = Math.min(cashRemaining, applied);
      const savingsApplied = applied - cashApplied;
      const realizedSplit = getRealizedAllocationSplit(
        {
          amountPaid: paid,
          interestDue: schedule.interestDue,
          principalDue: schedule.principalDue,
        },
        applied,
      );
      schedule.amountPaid = Number((paid + applied).toFixed(2));
      const statusDate = paymentDate ?? schedule.dueDate;
      const paymentDateObj = new Date(`${statusDate}T00:00:00Z`);
      schedule.status = this.resolveScheduleStatus(schedule, paymentDateObj);
      touched.set(schedule.id, schedule);
      allocations.set(
        schedule.id,
        allocationRepository.create({
          repaymentId: repayment.id,
          scheduleId: schedule.id,
          amountApplied: applied,
          cashPortion: cashApplied,
          savingsPortion: savingsApplied,
          principalPortion: realizedSplit.principalPortion,
          interestPortion: realizedSplit.interestPortion,
        }),
      );
      remaining -= applied;
      cashRemaining = Math.max(0, cashRemaining - cashApplied);
      savingsRemaining = Math.max(0, savingsRemaining - savingsApplied);
    }

    if (remaining > epsilon && schedules.length > 0) {
      const last = schedules[schedules.length - 1];
      last.advanceApplied = Number(
        (Number(last.advanceApplied || 0) + remaining).toFixed(2),
      );
      last.status = LoanRepaymentStatus.PAID;
      touched.set(last.id, last);
      const cashApplied = Math.min(cashRemaining, remaining);
      const savingsApplied = Math.max(0, remaining - cashRemaining);
      const existingAllocation = allocations.get(last.id);
      if (existingAllocation) {
        existingAllocation.amountApplied = Number(
          (Number(existingAllocation.amountApplied || 0) + remaining).toFixed(
            2,
          ),
        );
        existingAllocation.cashPortion = Number(
          (Number(existingAllocation.cashPortion || 0) + cashApplied).toFixed(
            2,
          ),
        );
        existingAllocation.savingsPortion = Number(
          (
            Number(existingAllocation.savingsPortion || 0) + savingsApplied
          ).toFixed(2),
        );
      } else {
        allocations.set(
          last.id,
          allocationRepository.create({
            repaymentId: repayment.id,
            scheduleId: last.id,
            amountApplied: remaining,
            cashPortion: cashApplied,
            savingsPortion: savingsApplied,
            principalPortion: 0,
            interestPortion: 0,
          }),
        );
      }
      remaining = 0;
    }

    if (touched.size > 0) {
      await scheduleRepository.save([...touched.values()]);
    }
    if (allocations.size > 0) {
      await allocationRepository.save([...allocations.values()]);
    }
  }

  private async replayExistingRepayments(
    loan: Loan,
    member: Member,
    center: Center | null,
  ): Promise<void> {
    await this.ensureLoanSchedule(loan, member, center);
    const schedules = await this.scheduleRepo.find({
      where: { loanId: loan.id },
    });
    if (!schedules.length) return;

    const scheduleIds = schedules.map((s) => s.id);
    const preservedAllocations = await this.allocationRepo.find({
      where: { scheduleId: In(scheduleIds) },
    });
    const preservedByRepayment = preservedAllocations.reduce(
      (totals, allocation) => {
        const current = totals.get(allocation.repaymentId) ?? {
          amount: 0,
          cash: 0,
          savings: 0,
        };
        current.amount += Number(allocation.amountApplied || 0);
        current.cash += Number(allocation.cashPortion || 0);
        current.savings += Number(allocation.savingsPortion || 0);
        totals.set(allocation.repaymentId, current);
        return totals;
      },
      new Map<string, { amount: number; cash: number; savings: number }>(),
    );
    await this.allocationRepo.delete({ scheduleId: In(scheduleIds) });

    for (const schedule of schedules) {
      schedule.amountPaid = 0;
      schedule.advanceApplied = 0;
      schedule.status = LoanRepaymentStatus.UNPAID;
    }
    await this.scheduleRepo.save(schedules);

    const approvedEntries = await this.repaymentRepo.find({
      where: { loan: { id: loan.id }, status: RepaymentStatus.APPROVED },
      relations: ['loan'],
    });

    const reversedRepaymentIds = new Set(
      approvedEntries
        .filter(
          (entry) =>
            entry.operationType === RepaymentOperationType.REVERSAL &&
            Boolean(entry.relatedRepaymentId),
        )
        .map((entry) => entry.relatedRepaymentId as string),
    );

    const approvedPayments = approvedEntries.filter(
      (entry) =>
        entry.operationType !== RepaymentOperationType.REVERSAL &&
        !reversedRepaymentIds.has(entry.id),
    );

    for (const repayment of approvedPayments) {
      if (repayment.paymentDate) {
        continue;
      }

      repayment.paymentDate = this.normalizeCollectionDate(
        repayment.collectionDate ?? repayment.createdAt?.toISOString(),
      );
      await this.repaymentRepo.update(repayment.id, {
        paymentDate: repayment.paymentDate,
      });
    }

    approvedPayments.sort((left, right) => {
      const leftDate = this.getRepaymentAppliedDate(left)?.getTime() ?? 0;
      const rightDate = this.getRepaymentAppliedDate(right)?.getTime() ?? 0;

      if (leftDate !== rightDate) {
        return leftDate - rightDate;
      }

      return (
        (left.createdAt?.getTime() ?? 0) - (right.createdAt?.getTime() ?? 0)
      );
    });

    for (const repayment of approvedPayments) {
      const preserved = preservedByRepayment.get(repayment.id);
      const chargeAllocation = preserved
        ? { total: 0, cash: 0, savings: 0 }
        : await this.loanChargesService.getRecordedPaymentAllocation(
            repayment.id,
          );
      const savingsDebit = preserved
        ? null
        : await this.savingsRepo.findOne({
            where: {
              idempotencyKey: repaymentSavingsDebitIdempotencyKey(repayment.id),
            },
          });
      const totalSavings = preserved
        ? preserved.savings
        : Math.abs(Number(savingsDebit?.amount || 0));
      const allocationAmount = preserved
        ? preserved.amount
        : Math.max(
            0,
            Number(repayment.amount || 0) +
              totalSavings -
              chargeAllocation.total,
          );
      const cashPortion = preserved
        ? preserved.cash
        : Math.max(0, Number(repayment.amount || 0) - chargeAllocation.cash);
      const savingsPortion = preserved
        ? preserved.savings
        : Math.max(0, totalSavings - chargeAllocation.savings);
      await this.applyRepaymentToSchedule({
        loan,
        member,
        center,
        repayment,
        allocationAmount,
        cashPortion,
        savingsPortion,
        paymentDate: repayment.paymentDate,
      });
    }
  }

  private getRepaymentAppliedDate(repayment: Repayment): Date | null {
    if (!repayment.paymentDate) {
      return null;
    }

    return this.parseDate(repayment.paymentDate);
  }

  async findPendingRepayments(): Promise<Repayment[]> {
    return this.repaymentRepo.find({
      where: { status: RepaymentStatus.PENDING },
      relations: ['loan', 'member', 'center'],
      order: { createdAt: 'DESC' },
    });
  }

  private businessDateExpression(alias: string): string {
    return `COALESCE(${alias}."collectionDate", (${alias}."createdAt" AT TIME ZONE 'UTC')::date)`;
  }

  async findPendingCollections(): Promise<PendingRepaymentCollectionGroup[]> {
    const pendingEntries = await this.repaymentRepo.find({
      where: { status: RepaymentStatus.PENDING },
      relations: ['center', 'batch'],
      order: { createdAt: 'DESC' },
    });

    const grouped = new Map<string, PendingRepaymentCollectionGroup>();

    for (const entry of pendingEntries) {
      const center = entry.center;
      if (!center?.id) {
        continue;
      }

      if (
        entry.batchId &&
        entry.batch?.status !== CollectionBatchStatus.PENDING
      ) {
        continue;
      }

      const collectionDate = this.normalizeCollectionDate(
        entry.collectionDate ?? entry.createdAt?.toISOString(),
      );
      const batchId = entry.batchId ?? null;
      const key = `${batchId ?? 'legacy'}::${center.id}::${collectionDate}`;
      const amount = Number(entry.amount || 0);
      const operationType = entry.operationType;

      const current = grouped.get(key) ?? {
        batchId,
        centerId: center.id,
        centerName: center.name || 'Unknown center',
        collectionDate,
        pendingCount: 0,
        paymentCount: 0,
        reversalCount: 0,
        paymentAmount: 0,
        reversalAmount: 0,
        netAmount: 0,
      };

      current.pendingCount += 1;
      if (operationType === RepaymentOperationType.REVERSAL) {
        current.reversalCount += 1;
        current.reversalAmount += amount;
        current.netAmount -= amount;
      } else {
        current.paymentCount += 1;
        current.paymentAmount += amount;
        current.netAmount += amount;
      }

      grouped.set(key, current);
    }

    return [...grouped.values()]
      .map((item) => ({
        ...item,
        paymentAmount: Number(item.paymentAmount.toFixed(2)),
        reversalAmount: Number(item.reversalAmount.toFixed(2)),
        netAmount: Number(item.netAmount.toFixed(2)),
      }))
      .sort(
        (a, b) =>
          b.collectionDate.localeCompare(a.collectionDate) ||
          a.centerName.localeCompare(b.centerName),
      );
  }

  async findPendingRepaymentsForCollection(
    centerId: string,
    collectionDate: string,
  ): Promise<Repayment[]> {
    const normalizedDate = this.normalizeCollectionDate(collectionDate);
    return this.findPendingRepaymentsByCollection(centerId, normalizedDate);
  }

  private async findPendingRepaymentsByCollection(
    centerId: string,
    collectionDate: string,
  ): Promise<Repayment[]> {
    const businessDateExpr = this.businessDateExpression('repayment');
    return this.repaymentRepo
      .createQueryBuilder('repayment')
      .leftJoinAndSelect('repayment.loan', 'loan')
      .leftJoinAndSelect('repayment.member', 'member')
      .leftJoinAndSelect('repayment.center', 'center')
      .where('repayment.status = :pendingStatus', {
        pendingStatus: RepaymentStatus.PENDING,
      })
      .andWhere('center.id = :centerId', { centerId })
      .andWhere(`${businessDateExpr} = CAST(:collectionDate AS date)`, {
        collectionDate,
      })
      .orderBy('repayment.createdAt', 'ASC')
      .getMany();
  }

  private async findPendingRepaymentsByBatch(
    batchId: string,
  ): Promise<Repayment[]> {
    return this.repaymentRepo.find({
      where: {
        batchId,
        status: RepaymentStatus.PENDING,
      },
      relations: ['loan', 'member', 'center'],
      order: { createdAt: 'ASC' },
    });
  }

  async approvePendingCollection(
    centerId: string,
    collectionDate: string,
    actorId?: string,
  ): Promise<PendingCollectionActionResult> {
    const normalizedDate = this.normalizeCollectionDate(collectionDate);
    const pendingBatch = await this.collectionBatchRepo.findOne({
      where: {
        centerId,
        collectionDate: normalizedDate,
        status: CollectionBatchStatus.PENDING,
      },
    });
    const pendingRepayments = pendingBatch
      ? await this.findPendingRepaymentsByBatch(pendingBatch.id)
      : await this.findPendingRepaymentsByCollection(centerId, normalizedDate);

    if (!pendingRepayments.length) {
      throw new NotFoundException(
        'No pending repayments found for the selected collection',
      );
    }

    const approvedPaymentIds: string[] = [];
    for (const repayment of pendingRepayments) {
      try {
        const approved = await this.approveRepayment(repayment.id, actorId);
        if (
          approved.status === RepaymentStatus.APPROVED &&
          approved.operationType === RepaymentOperationType.PAYMENT
        ) {
          approvedPaymentIds.push(approved.id);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown approval error';
        throw new BadRequestException(
          `Failed to approve collection. Repayment ${repayment.id}: ${message}`,
        );
      }
    }

    if (pendingBatch) {
      pendingBatch.status = CollectionBatchStatus.APPROVED;
      pendingBatch.approvedById = actorId ?? null;
      pendingBatch.approvedAt = new Date();
      pendingBatch.rejectedById = null;
      pendingBatch.rejectedAt = null;
      pendingBatch.rejectedReason = null;
      await this.collectionBatchRepo.save(pendingBatch);
    }

    return {
      batchId: pendingBatch?.id ?? null,
      centerId,
      collectionDate: normalizedDate,
      processedCount: pendingRepayments.length,
      approvedCount: pendingRepayments.length,
      approvedPaymentIds,
    };
  }

  async rejectPendingCollection(
    centerId: string,
    collectionDate: string,
    actorId?: string,
    reason?: string,
  ): Promise<PendingCollectionActionResult> {
    const normalizedDate = this.normalizeCollectionDate(collectionDate);
    const pendingBatch = await this.collectionBatchRepo.findOne({
      where: {
        centerId,
        collectionDate: normalizedDate,
        status: CollectionBatchStatus.PENDING,
      },
    });
    const pendingRepayments = pendingBatch
      ? await this.findPendingRepaymentsByBatch(pendingBatch.id)
      : await this.findPendingRepaymentsByCollection(centerId, normalizedDate);

    if (!pendingRepayments.length) {
      throw new NotFoundException(
        'No pending repayments found for the selected collection',
      );
    }

    for (const repayment of pendingRepayments) {
      try {
        await this.rejectRepayment(repayment.id, actorId, reason);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown rejection error';
        throw new BadRequestException(
          `Failed to reject collection. Repayment ${repayment.id}: ${message}`,
        );
      }
    }

    if (pendingBatch) {
      pendingBatch.status = CollectionBatchStatus.REJECTED;
      pendingBatch.rejectedById = actorId ?? null;
      pendingBatch.rejectedAt = new Date();
      pendingBatch.rejectedReason = reason?.trim() || null;
      pendingBatch.approvedById = null;
      pendingBatch.approvedAt = null;
      await this.collectionBatchRepo.save(pendingBatch);
    }

    return {
      batchId: pendingBatch?.id ?? null,
      centerId,
      collectionDate: normalizedDate,
      processedCount: pendingRepayments.length,
      rejectedCount: pendingRepayments.length,
    };
  }

  async approveRepayment(id: string, actorId?: string): Promise<Repayment> {
    const repaymentReference = await this.repaymentRepo.findOne({
      where: { id },
      relations: ['loan'],
    });
    if (!repaymentReference) {
      throw new NotFoundException('Repayment not found');
    }
    const loanId = repaymentReference.loan?.id;
    if (!loanId) {
      throw new NotFoundException('Loan not found');
    }

    return this.repaymentRepo.manager.transaction(async (manager) => {
      const businessDate = getFinancialBusinessDate();
      const loanRepository = manager.getRepository(Loan);
      const repaymentRepository = manager.getRepository(Repayment);
      await loanRepository
        .createQueryBuilder('loan')
        .setLock('pessimistic_write')
        .where('loan.id = :loanId', { loanId })
        .getOne();
      const loan = await loanRepository.findOne({
        where: { id: loanId },
        relations: ['borrower', 'borrower.center'],
      });
      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      await repaymentRepository
        .createQueryBuilder('repayment')
        .setLock('pessimistic_write')
        .where('repayment.id = :id', { id })
        .getOne();
      const repayment = await repaymentRepository.findOne({
        where: { id },
        relations: ['loan', 'member', 'center'],
      });
      if (!repayment) {
        throw new NotFoundException('Repayment not found');
      }
      if (repayment.status !== RepaymentStatus.PENDING) {
        throw new BadRequestException(
          'Only pending repayments can be approved',
        );
      }

      if (repayment.operationType === RepaymentOperationType.REVERSAL) {
        return this.approveReversalRepayment(
          repayment,
          loan,
          manager,
          businessDate,
          actorId,
        );
      }

      return this.approvePaymentRepayment(
        repayment,
        loan,
        manager,
        businessDate,
        actorId,
      );
    });
  }

  async getAllocationPreview(id: string): Promise<RepaymentAllocationPreview> {
    const repaymentReference = await this.repaymentRepo.findOne({
      where: { id },
      relations: ['loan'],
    });
    if (!repaymentReference) throw new NotFoundException('Repayment not found');
    if (repaymentReference.status !== RepaymentStatus.PENDING) {
      throw new BadRequestException(
        'Allocation preview is available only for pending repayments',
      );
    }
    if (repaymentReference.operationType === RepaymentOperationType.REVERSAL) {
      throw new BadRequestException(
        'Allocation preview is available only for payment repayments',
      );
    }
    const loanId = repaymentReference.loan?.id;
    if (!loanId) throw new NotFoundException('Loan not found');

    const queryRunner =
      this.repaymentRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      const loanRepository = manager.getRepository(Loan);
      const repaymentRepository = manager.getRepository(Repayment);
      await loanRepository
        .createQueryBuilder('loan')
        .setLock('pessimistic_write')
        .where('loan.id = :loanId', { loanId })
        .getOne();
      await repaymentRepository
        .createQueryBuilder('repayment')
        .setLock('pessimistic_write')
        .where('repayment.id = :id', { id })
        .getOne();
      const [loan, repayment] = await Promise.all([
        loanRepository.findOne({ where: { id: loanId } }),
        repaymentRepository.findOne({ where: { id } }),
      ]);
      if (!loan) throw new NotFoundException('Loan not found');
      if (!repayment) throw new NotFoundException('Repayment not found');

      const asOfDate = getFinancialBusinessDate();
      const collectionDate =
        repayment.collectionDate ??
        this.normalizeCollectionDate(repayment.createdAt.toISOString());
      await this.loanChargesService.postDueChargesForLoan(
        loan.id,
        asOfDate,
        manager,
        {
          id: repayment.id,
          collectionDate,
          cashAmount: Number(repayment.amount),
          useSavings: Boolean(repayment.useSavings),
        },
      );
      const projectedLoan = await loanRepository.findOne({
        where: { id: loan.id },
      });
      if (!projectedLoan) throw new NotFoundException('Loan not found');
      const allocation = this.loanChargesService.previewPaymentAllocation(
        projectedLoan,
        Number(repayment.amount),
        Boolean(repayment.useSavings),
      );
      await queryRunner.rollbackTransaction();
      return { repaymentId: id, loanId, asOfDate, allocation };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async approvePaymentRepayment(
    repayment: Repayment,
    loan: Loan,
    manager: EntityManager,
    businessDate: string,
    actorId?: string,
  ): Promise<Repayment> {
    const member = repayment.member;
    const center = repayment.center ?? member?.center ?? null;
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const appliedDate =
      repayment.collectionDate ??
      this.normalizeCollectionDate(repayment.createdAt.toISOString());
    await this.loanChargesService.postDueChargesForLoan(
      loan.id,
      businessDate,
      manager,
      {
        id: repayment.id,
        collectionDate: appliedDate,
        cashAmount: Number(repayment.amount),
        useSavings: Boolean(repayment.useSavings),
      },
    );

    const application = await this.loansService.applyRepaymentWithAllocation(
      loan.id,
      Number(repayment.amount),
      Boolean(repayment.useSavings),
      manager,
      {
        repaymentId: repayment.id,
        actorId,
        businessDate,
      },
    );

    const updatedLoan = await manager.getRepository(Loan).findOne({
      where: { id: loan.id },
      relations: ['borrower', 'borrower.center'],
    });
    const targetLoan = updatedLoan ?? loan;

    await this.ensureLoanSchedule(targetLoan, member, center, manager);

    const newlyAppliedAmount = application.allocation.contractual.amount;

    if (newlyAppliedAmount > 0) {
      await this.applyRepaymentToSchedule(
        {
          loan: targetLoan,
          member,
          center,
          repayment,
          allocationAmount: newlyAppliedAmount,
          cashPortion: application.allocation.contractual.cashPortion,
          savingsPortion: application.allocation.contractual.savingsPortion,
          paymentDate: appliedDate,
        },
        manager,
      );
    }

    const targetCenterId = center?.id ?? repayment.center?.id;
    if (!targetCenterId) {
      throw new NotFoundException('Center not found');
    }

    await this.recordCollectionEntry(
      {
        memberId: member.id,
        centerId: targetCenterId,
        collectionDate:
          repayment.collectionDate ?? this.normalizeCollectionDate(),
        weeklyAmount:
          Number(targetLoan.weeklyPaymentAmount) ||
          Number(loan.weeklyPaymentAmount) ||
          0,
        amountApplied: newlyAppliedAmount,
        totalWeeksPaid: Number(targetLoan.weeksPaid) || 0,
        notes: repayment.notes ?? undefined,
      },
      manager,
    );

    const approved = await this.markRepaymentApproved(
      repayment,
      actorId,
      manager,
    );
    return Object.assign(approved, { allocation: application.allocation });
  }

  private async approveReversalRepayment(
    reversal: Repayment,
    loan: Loan,
    manager: EntityManager,
    businessDate: string,
    actorId?: string,
  ): Promise<Repayment> {
    const originalRepaymentId = reversal.relatedRepaymentId;
    if (!originalRepaymentId) {
      throw new BadRequestException(
        'Reversal request is missing source repayment reference',
      );
    }

    const repaymentRepository = manager.getRepository(Repayment);
    await repaymentRepository
      .createQueryBuilder('repayment')
      .setLock('pessimistic_write')
      .where('repayment.id = :originalRepaymentId', { originalRepaymentId })
      .getOne();
    const original = await repaymentRepository.findOne({
      where: { id: originalRepaymentId },
      relations: ['loan', 'member', 'center'],
    });
    if (!original) {
      throw new NotFoundException('Original repayment not found');
    }
    if (original.operationType === RepaymentOperationType.REVERSAL) {
      throw new BadRequestException(
        'Original repayment for reversal is invalid',
      );
    }
    if (original.status !== RepaymentStatus.APPROVED) {
      throw new BadRequestException('Only approved repayments can be reversed');
    }

    const approvedReversal = await repaymentRepository.findOne({
      where: {
        id: Not(reversal.id),
        relatedRepaymentId: original.id,
        operationType: RepaymentOperationType.REVERSAL,
        status: RepaymentStatus.APPROVED,
      },
    });
    if (approvedReversal) {
      throw new BadRequestException('Repayment has already been reversed');
    }

    const member = original.member ?? loan.borrower;
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    const center =
      original.center ?? member.center ?? loan.borrower?.center ?? null;
    if (!center?.id) {
      throw new NotFoundException('Center not found');
    }

    const allocationRepository = manager.getRepository(LoanRepaymentAllocation);
    const scheduleRepository = manager.getRepository(LoanRepaymentSchedule);
    const savingsRepository = manager.getRepository(Savings);
    const originalAllocations = await allocationRepository.find({
      where: { repaymentId: original.id },
    });
    const chargeReversal =
      await this.loanChargesService.reversePaymentAllocation(
        loan,
        original.id,
        reversal.id,
        manager,
      );

    const totalApplied = originalAllocations.length
      ? originalAllocations.reduce(
          (sum, allocation) => sum + Number(allocation.amountApplied || 0),
          0,
        )
      : this.loanChargesService.isEligible(loan)
        ? 0
        : Number(original.amount || 0);
    const savingsUsed =
      originalAllocations.reduce(
        (sum, allocation) => sum + Number(allocation.savingsPortion || 0),
        0,
      ) + chargeReversal.savingsReversed;
    const originalSavingsDebit =
      savingsUsed > 0
        ? await savingsRepository.findOne({
            where: {
              eventType: SavingsEventType.REPAYMENT_DEBIT,
              idempotencyKey: repaymentSavingsDebitIdempotencyKey(original.id),
            },
          })
        : null;
    // Pre-ledger debit rows have no deterministic repayment provenance. Leave
    // reversalOfId null for those rows instead of fabricating a historical link.

    const paymentDate = this.parseDate(
      reversal.collectionDate ??
        this.normalizeCollectionDate(reversal.createdAt.toISOString()),
    );

    if (originalAllocations.length > 0) {
      const rollbackByScheduleId = new Map<string, number>();
      for (const allocation of originalAllocations) {
        const current = rollbackByScheduleId.get(allocation.scheduleId) ?? 0;
        rollbackByScheduleId.set(
          allocation.scheduleId,
          current + Number(allocation.amountApplied || 0),
        );
      }

      const targetSchedules = await scheduleRepository.find({
        where: { id: In([...rollbackByScheduleId.keys()]) },
      });
      for (const schedule of targetSchedules) {
        const rollbackAmount = rollbackByScheduleId.get(schedule.id) ?? 0;
        const currentPaid = Number(schedule.amountPaid || 0);
        schedule.amountPaid = Number(
          Math.max(0, currentPaid - rollbackAmount).toFixed(2),
        );
        schedule.status = this.resolveScheduleStatus(schedule, paymentDate);
      }
      if (targetSchedules.length > 0) {
        await scheduleRepository.save(targetSchedules);
      }

      await allocationRepository.delete({ repaymentId: original.id });
    }

    const previousAmountPaid = Number(loan.amountPaid || 0);
    const updatedAmountPaid = Math.max(0, previousAmountPaid - totalApplied);
    const weeklyAmount = Number(loan.weeklyPaymentAmount || 0);
    const recomputedWeeksPaid =
      weeklyAmount > 0 ? Math.floor(updatedAmountPaid / weeklyAmount) : 0;
    const recomputedBuffer =
      weeklyAmount > 0
        ? Number(
            (updatedAmountPaid - recomputedWeeksPaid * weeklyAmount).toFixed(2),
          )
        : 0;

    loan.amountPaid = updatedAmountPaid;
    loan.weeksPaid = recomputedWeeksPaid;
    loan.advancePaymentBuffer = recomputedBuffer;
    loan.balance = Number(
      Math.max(0, Number(loan.totalAmount || 0) - updatedAmountPaid).toFixed(2),
    );
    const savingsBalanceBefore = Number(loan.savings || 0);
    const savingsBalanceAfter = Number(
      (savingsBalanceBefore + Number(savingsUsed || 0)).toFixed(2),
    );
    loan.savings = savingsBalanceAfter;
    const chargeOutstanding = this.loanChargesService.getOutstanding(loan);
    if (loan.balance === 0 && chargeOutstanding.totalOutstanding === 0) {
      loan.status = 'paid';
    } else if (
      loan.status === 'paid' &&
      (loan.balance > 0 || chargeOutstanding.totalOutstanding > 0)
    ) {
      loan.status = 'active';
    }
    await manager.getRepository(Loan).save(loan);

    if (savingsUsed > 0) {
      const savingsEntry = savingsRepository.create({
        borrower: member,
        loan,
        amount: Number(savingsUsed.toFixed(2)),
        remarks: `Reversal credit for repayment ${original.id}`,
        eventType: SavingsEventType.REPAYMENT_REVERSAL_CREDIT,
        balanceBefore: savingsBalanceBefore,
        balanceAfter: savingsBalanceAfter,
        businessDate,
        referenceType: SAVINGS_REFERENCE_TYPE.REPAYMENT_REVERSAL,
        referenceId: reversal.id,
        idempotencyKey: repaymentSavingsReversalIdempotencyKey(reversal.id),
        performedById: actorId ?? null,
        reversalOfId: originalSavingsDebit?.id ?? null,
      });
      await savingsRepository.save(savingsEntry);
    }

    await this.reverseCollectionEntry(
      {
        memberId: member.id,
        centerId: center.id,
        collectionDate:
          original.collectionDate ??
          this.normalizeCollectionDate(original.createdAt.toISOString()),
        amountToReverse: totalApplied,
        totalWeeksPaid: Number(loan.weeksPaid) || 0,
        notes: reversal.notes ?? undefined,
      },
      manager,
    );

    return this.markRepaymentApproved(reversal, actorId, manager);
  }

  private async markRepaymentApproved(
    repayment: Repayment,
    actorId?: string,
    manager?: EntityManager,
  ): Promise<Repayment> {
    repayment.status = RepaymentStatus.APPROVED;
    repayment.approvedById = actorId ?? null;
    repayment.approvedAt = new Date();
    repayment.rejectedById = null;
    repayment.rejectedAt = null;
    repayment.rejectedReason = null;
    if (!repayment.collectionDate) {
      repayment.collectionDate = this.normalizeCollectionDate();
    }
    if (!repayment.paymentDate) {
      repayment.paymentDate = repayment.collectionDate;
    }
    return (manager?.getRepository(Repayment) ?? this.repaymentRepo).save(
      repayment,
    );
  }

  async rejectRepayment(
    id: string,
    actorId?: string,
    reason?: string,
  ): Promise<Repayment> {
    const repayment = await this.repaymentRepo.findOne({ where: { id } });
    if (!repayment) {
      throw new NotFoundException('Repayment not found');
    }

    if (repayment.status !== RepaymentStatus.PENDING) {
      throw new BadRequestException('Only pending repayments can be rejected');
    }

    repayment.status = RepaymentStatus.REJECTED;
    repayment.rejectedById = actorId ?? null;
    repayment.rejectedAt = new Date();
    repayment.rejectedReason = reason?.trim() || null;
    return this.repaymentRepo.save(repayment);
  }

  async getScheduleForLoan(loanId: string) {
    const loan = await this.loanRepo.findOne({
      where: { id: loanId },
      relations: ['borrower', 'borrower.center'],
    });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }
    const member = loan.borrower;
    if (!member) {
      throw new NotFoundException('Loan has no borrower');
    }
    const center = member.center ?? null;

    await this.ensureLoanSchedule(loan, member, center);

    const schedule = await this.scheduleRepo.find({
      where: { loanId },
      order: { weekNumber: 'ASC', dueDate: 'ASC' },
    });

    if (loan.status === 'paid') {
      return schedule.map((row) => ({
        ...row,
        status:
          row.status === LoanRepaymentStatus.ADVANCE
            ? LoanRepaymentStatus.PAID
            : row.status,
      }));
    }

    return schedule;
  }

  private async reverseCollectionEntry(
    params: {
      memberId: string;
      centerId: string;
      collectionDate: string;
      amountToReverse: number;
      totalWeeksPaid: number;
      notes?: string;
    },
    manager?: EntityManager,
  ) {
    const {
      memberId,
      centerId,
      collectionDate,
      amountToReverse,
      totalWeeksPaid,
      notes,
    } = params;
    const collectionRepository =
      manager?.getRepository(Collection) ?? this.collectionRepo;
    const existing = await collectionRepository.findOne({
      where: { memberId, centerId, collectionDate },
    });
    if (!existing) {
      return;
    }

    const nextReceived = Math.max(
      0,
      Number(existing.paymentReceived || 0) - Number(amountToReverse || 0),
    );
    existing.paymentReceived = Number(nextReceived.toFixed(2));
    existing.numberOfPayments = totalWeeksPaid;
    if (notes) {
      existing.notes = notes;
    }
    await collectionRepository.save(existing);
  }

  private async recordCollectionEntry(
    params: {
      memberId: string;
      centerId: string;
      collectionDate: string;
      weeklyAmount: number;
      amountApplied: number;
      totalWeeksPaid: number;
      notes?: string;
    },
    manager?: EntityManager,
  ) {
    const {
      memberId,
      centerId,
      collectionDate,
      weeklyAmount,
      amountApplied,
      totalWeeksPaid,
      notes,
    } = params;

    const applied = Number(amountApplied || 0);
    const collectionRepository =
      manager?.getRepository(Collection) ?? this.collectionRepo;
    const existing = await collectionRepository.findOne({
      where: { memberId, centerId, collectionDate },
    });

    if (existing) {
      existing.paymentReceived = Number(
        (Number(existing.paymentReceived || 0) + applied).toFixed(2),
      );
      existing.amount =
        Number(existing.amount || 0) > 0
          ? existing.amount
          : Number(weeklyAmount || 0);
      existing.numberOfPayments = totalWeeksPaid;
      if (notes) {
        existing.notes = notes;
      }
      await collectionRepository.save(existing);
      return;
    }

    const collection = collectionRepository.create({
      memberId,
      centerId,
      collectionDate,
      amount: weeklyAmount,
      netRelease: 0,
      paymentReceived: applied,
      isAutoGenerated: false,
      numberOfPayments: totalWeeksPaid,
      advancePaymentAmount: 0,
      advancePaymentStatus: AdvancePaymentStatus.NONE,
      notes,
    });
    await collectionRepository.save(collection);
  }
}
