import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { EntityManager, LessThanOrEqual, Not, Repository } from 'typeorm';
import {
  addDaysToDateOnly,
  getWeeklyPenaltyAssessmentDate,
  laterDateOnly,
  parseDateOnly,
} from '../common/date-only';
import { decimal, money, moneyNumber, moneyString } from '../common/money';
import { LoanRepaymentSchedule } from '../repayments/entities/loan-repayment-schedule.entity';
import { getRealizedAllocationSplit } from '../repayments/loan-repayment-allocation.utils';
import {
  Repayment,
  RepaymentOperationType,
  RepaymentStatus,
} from '../repayments/repayment.entity';
import {
  calculateChargeOutstanding,
  calculateMaturityPenalty,
  calculatePastDueInterest,
  calculateWeeklyPenalty,
  MATURITY_PENALTY_RATE,
  PAST_DUE_MONTHLY_INTEREST_RATE,
} from './loan-charge-calculations';
import { OVERDUE_CHARGE_POLICY_V1 } from './loan-charge-policy.constants';
import { LoanChargePolicyService } from './loan-charge-policy.service';
import {
  LoanChargeLedger,
  LoanChargeLedgerEventType,
  LoanChargeType,
} from './entities/loan-charge-ledger.entity';
import { Loan } from './loan.entity';
import { LoanWaiver } from './entities/loan-waiver.entity';

export interface LoanChargeOutstanding {
  penaltyOutstanding: number;
  pastDueInterestOutstanding: number;
  totalOutstanding: number;
}

export interface LoanChargeSweepResult {
  asOfDate: string;
  scannedCount: number;
  processedCount: number;
  chargeCount: number;
  skippedPendingCount: number;
  failedCount: number;
  failures: Array<{ loanId: string; message: string }>;
}

export interface PaymentBucketAllocation {
  amount: number;
  cashPortion: number;
  savingsPortion: number;
}

export interface LoanPaymentAllocation {
  eligible: boolean;
  cashReceived: number;
  savingsUsed: number;
  totalApplied: number;
  penalty: PaymentBucketAllocation;
  pastDueInterest: PaymentBucketAllocation;
  contractual: PaymentBucketAllocation;
  unapplied: number;
}

export interface ChargePaymentReversalResult {
  penaltyReversed: number;
  pastDueInterestReversed: number;
  cashReversed: number;
  savingsReversed: number;
  totalReversed: number;
}

export interface RecordedChargePaymentAllocation {
  total: number;
  cash: number;
  savings: number;
}

export interface ChargeReconciliationResult {
  loanId: string;
  reconciled: boolean;
  summary: {
    penaltyAccrued: number;
    penaltyPaid: number;
    penaltyWaived: number;
    pastDueInterestAccrued: number;
    pastDueInterestPaid: number;
    pastDueInterestWaived: number;
  };
  ledger: {
    penaltyAccrued: number;
    penaltyPaid: number;
    penaltyWaived: number;
    pastDueInterestAccrued: number;
    pastDueInterestPaid: number;
    pastDueInterestWaived: number;
  };
}

export interface ResolvingRepayment {
  id: string;
  collectionDate: string;
  cashAmount: number;
  useSavings: boolean;
}

interface ChargePostingResult {
  chargeCount: number;
  skippedPendingCount: number;
}

type NewLedgerEntry = Omit<
  LoanChargeLedger,
  | 'id'
  | 'loan'
  | 'schedule'
  | 'sourceRepayment'
  | 'reversedLedgerEntry'
  | 'createdAt'
>;

type PenaltyChargeType =
  | LoanChargeType.WEEKLY_PENALTY
  | LoanChargeType.MATURITY_PENALTY;

const PENALTY_CHARGE_TYPES: readonly PenaltyChargeType[] = [
  LoanChargeType.WEEKLY_PENALTY,
  LoanChargeType.MATURITY_PENALTY,
];

@Injectable()
export class LoanChargesService {
  constructor(
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(LoanChargeLedger)
    private readonly ledgerRepository: Repository<LoanChargeLedger>,
    @InjectRepository(LoanRepaymentSchedule)
    private readonly scheduleRepository: Repository<LoanRepaymentSchedule>,
    @InjectRepository(LoanWaiver)
    private readonly waiverRepository: Repository<LoanWaiver>,
    private readonly policyService: LoanChargePolicyService,
  ) {}

  isEligible(loan: Loan, asOfDate?: string): boolean {
    return this.policyService.isEligible(loan, asOfDate);
  }

  getOutstanding(loan: Loan): LoanChargeOutstanding {
    const penalty = calculateChargeOutstanding(
      loan.penaltyAccrued,
      loan.penaltyPaid,
      loan.penaltyWaived,
    );
    const pastDueInterest = calculateChargeOutstanding(
      loan.pastDueInterestAccrued,
      loan.pastDueInterestPaid,
      loan.pastDueInterestWaived,
    );
    return {
      penaltyOutstanding: moneyNumber(penalty),
      pastDueInterestOutstanding: moneyNumber(pastDueInterest),
      totalOutstanding: moneyNumber(penalty.add(pastDueInterest)),
    };
  }

  async getBreakdown(loanId: string) {
    const loan = await this.loanRepository.findOne({
      where: { id: loanId },
      relations: ['borrower'],
    });
    if (!loan) throw new NotFoundException(`Loan #${loanId} not found`);

    const eligible = this.policyService.isEligible(loan);
    const entries = eligible
      ? await this.ledgerRepository.find({
          where: { loanId },
          order: { createdAt: 'DESC', id: 'DESC' },
          take: 200,
        })
      : [];

    return {
      loanId,
      policyVersion: loan.overdueChargePolicyVersion,
      policyEffectiveDate: loan.overdueChargePolicyEffectiveDate,
      eligible,
      legacy: !eligible,
      penaltyAccrued: moneyNumber(loan.penaltyAccrued),
      penaltyPaid: moneyNumber(loan.penaltyPaid),
      penaltyWaived: moneyNumber(loan.penaltyWaived),
      pastDueInterestAccrued: moneyNumber(loan.pastDueInterestAccrued),
      pastDueInterestPaid: moneyNumber(loan.pastDueInterestPaid),
      pastDueInterestWaived: moneyNumber(loan.pastDueInterestWaived),
      ...this.getOutstanding(loan),
      entries,
      reconciliation: eligible ? await this.reconcile(loanId) : null,
    };
  }

  previewPaymentAllocation(
    loan: Loan,
    cashAmount: Decimal.Value,
    useSavings: boolean,
  ): LoanPaymentAllocation {
    const cash = money(cashAmount);
    if (cash.lt(0)) {
      throw new BadRequestException('Payment amount must be >= 0');
    }

    const eligible = this.policyService.isEligible(loan);
    const contractualOutstanding = money(loan.balance);
    const expectedContractual = Decimal.min(
      money(loan.weeklyPaymentAmount),
      contractualOutstanding,
    );
    if (!eligible) {
      const availableSavings = money(loan.savings);
      const savings = useSavings
        ? Decimal.min(
            availableSavings,
            Decimal.max(0, expectedContractual.sub(cash)),
          )
        : new Decimal(0);
      const contractual = cash.add(savings);
      return {
        eligible: false,
        cashReceived: moneyNumber(cash),
        savingsUsed: moneyNumber(savings),
        totalApplied: moneyNumber(contractual),
        penalty: { amount: 0, cashPortion: 0, savingsPortion: 0 },
        pastDueInterest: { amount: 0, cashPortion: 0, savingsPortion: 0 },
        contractual: {
          amount: moneyNumber(contractual),
          cashPortion: moneyNumber(cash),
          savingsPortion: moneyNumber(savings),
        },
        unapplied: 0,
      };
    }

    const outstanding = this.getOutstanding(loan);
    const penaltyOutstanding = money(outstanding.penaltyOutstanding);
    const interestOutstanding = money(outstanding.pastDueInterestOutstanding);
    const target = penaltyOutstanding
      .add(interestOutstanding)
      .add(expectedContractual);
    const availableSavings = money(loan.savings);
    const savings = useSavings
      ? Decimal.min(availableSavings, Decimal.max(0, target.sub(cash)))
      : new Decimal(0);

    let cashRemaining = cash;
    let savingsRemaining = savings;
    const allocate = (maximum: Decimal): PaymentBucketAllocation => {
      const available = cashRemaining.add(savingsRemaining);
      const amount = Decimal.min(maximum, available);
      const cashPortion = Decimal.min(cashRemaining, amount);
      const savingsPortion = amount.sub(cashPortion);
      cashRemaining = cashRemaining.sub(cashPortion);
      savingsRemaining = savingsRemaining.sub(savingsPortion);
      return {
        amount: moneyNumber(amount),
        cashPortion: moneyNumber(cashPortion),
        savingsPortion: moneyNumber(savingsPortion),
      };
    };

    const penalty = allocate(penaltyOutstanding);
    const pastDueInterest = allocate(interestOutstanding);
    const contractual = allocate(contractualOutstanding);
    const unapplied = money(cashRemaining.add(savingsRemaining));

    return {
      eligible,
      cashReceived: moneyNumber(cash),
      savingsUsed: moneyNumber(savings.sub(savingsRemaining)),
      totalApplied: moneyNumber(
        decimal(penalty.amount)
          .add(pastDueInterest.amount)
          .add(contractual.amount),
      ),
      penalty,
      pastDueInterest,
      contractual,
      unapplied: moneyNumber(unapplied),
    };
  }

  async recordPaymentAllocation(
    loan: Loan,
    repaymentId: string,
    allocation: LoanPaymentAllocation,
    manager: EntityManager,
  ): Promise<void> {
    if (!this.policyService.isEligible(loan)) return;

    const penaltyCreated = await this.recordPenaltyPayment(
      loan,
      repaymentId,
      allocation.penalty,
      manager,
    );
    const interestCreated = await this.recordSingleChargePayment(
      loan,
      repaymentId,
      LoanChargeType.PAST_DUE_INTEREST,
      allocation.pastDueInterest,
      manager,
    );
    if (
      !penaltyCreated.eq(money(allocation.penalty.amount)) ||
      !interestCreated.eq(money(allocation.pastDueInterest.amount))
    ) {
      throw new ConflictException(
        'Charge allocation could not be recorded exactly; transaction was aborted',
      );
    }

    if (penaltyCreated.gt(0)) {
      loan.penaltyPaid = moneyNumber(
        decimal(loan.penaltyPaid).add(penaltyCreated),
      );
    }
    if (interestCreated.gt(0)) {
      loan.pastDueInterestPaid = moneyNumber(
        decimal(loan.pastDueInterestPaid).add(interestCreated),
      );
    }
  }

  async reversePaymentAllocation(
    loan: Loan,
    originalRepaymentId: string,
    reversalRepaymentId: string,
    manager: EntityManager,
  ): Promise<ChargePaymentReversalResult> {
    const repository = manager.getRepository(LoanChargeLedger);
    const originalEntries = await repository.find({
      where: {
        loanId: loan.id,
        sourceRepaymentId: originalRepaymentId,
        eventType: LoanChargeLedgerEventType.PAYMENT,
      },
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    let penalty = new Decimal(0);
    let interest = new Decimal(0);
    let cash = new Decimal(0);
    let savings = new Decimal(0);

    for (const original of originalEntries) {
      const created = await this.createLedgerEntryIfMissing(
        {
          loanId: loan.id,
          scheduleId: original.scheduleId,
          policyVersion: original.policyVersion,
          chargeType: original.chargeType,
          eventType: LoanChargeLedgerEventType.PAYMENT_REVERSAL,
          amount: moneyString(original.amount),
          cashPortion: moneyString(original.cashPortion),
          savingsPortion: moneyString(original.savingsPortion),
          baseAmount: '0.00',
          rate: '0.00000000',
          periodStart: original.periodStart,
          periodEnd: original.periodEnd,
          sourceRepaymentId: reversalRepaymentId,
          reversedLedgerEntryId: original.id,
          idempotencyKey: `loan-charge:v1:${loan.id}:repayment-reversal:${reversalRepaymentId}:${original.id}`,
          metadata: { originalRepaymentId },
        },
        manager,
      );
      if (!created) continue;

      const amount = money(original.amount);
      if (original.chargeType === LoanChargeType.PAST_DUE_INTEREST) {
        interest = interest.add(amount);
      } else {
        penalty = penalty.add(amount);
      }
      cash = cash.add(original.cashPortion);
      savings = savings.add(original.savingsPortion);
    }

    loan.penaltyPaid = moneyNumber(
      Decimal.max(0, decimal(loan.penaltyPaid).sub(penalty)),
    );
    loan.pastDueInterestPaid = moneyNumber(
      Decimal.max(0, decimal(loan.pastDueInterestPaid).sub(interest)),
    );

    return {
      penaltyReversed: moneyNumber(penalty),
      pastDueInterestReversed: moneyNumber(interest),
      cashReversed: moneyNumber(cash),
      savingsReversed: moneyNumber(savings),
      totalReversed: moneyNumber(penalty.add(interest)),
    };
  }

  async getRecordedPaymentAllocation(
    repaymentId: string,
    manager?: EntityManager,
  ): Promise<RecordedChargePaymentAllocation> {
    const repository =
      manager?.getRepository(LoanChargeLedger) ?? this.ledgerRepository;
    const entries = await repository.find({
      where: {
        sourceRepaymentId: repaymentId,
        eventType: LoanChargeLedgerEventType.PAYMENT,
      },
    });
    return entries.reduce(
      (total, entry) => ({
        total: moneyNumber(decimal(total.total).add(entry.amount)),
        cash: moneyNumber(decimal(total.cash).add(entry.cashPortion)),
        savings: moneyNumber(decimal(total.savings).add(entry.savingsPortion)),
      }),
      { total: 0, cash: 0, savings: 0 },
    );
  }

  async reconcile(loanId: string): Promise<ChargeReconciliationResult> {
    const [loan, entries, waivers] = await Promise.all([
      this.loanRepository.findOne({ where: { id: loanId } }),
      this.ledgerRepository.find({ where: { loanId } }),
      this.waiverRepository.find({ where: { loanId } }),
    ]);
    if (!loan) throw new NotFoundException(`Loan #${loanId} not found`);

    const ledger = {
      penaltyAccrued: new Decimal(0),
      penaltyPaid: new Decimal(0),
      penaltyWaived: waivers.reduce(
        (total, waiver) => total.add(waiver.penaltyWaived),
        new Decimal(0),
      ),
      pastDueInterestAccrued: new Decimal(0),
      pastDueInterestPaid: new Decimal(0),
      pastDueInterestWaived: waivers.reduce(
        (total, waiver) => total.add(waiver.pastDueInterestWaived),
        new Decimal(0),
      ),
    };

    for (const entry of entries) {
      const isInterest = entry.chargeType === LoanChargeType.PAST_DUE_INTEREST;
      const amount = money(entry.amount);
      if (entry.eventType === LoanChargeLedgerEventType.ACCRUAL) {
        if (isInterest)
          ledger.pastDueInterestAccrued =
            ledger.pastDueInterestAccrued.add(amount);
        else ledger.penaltyAccrued = ledger.penaltyAccrued.add(amount);
      } else if (entry.eventType === LoanChargeLedgerEventType.PAYMENT) {
        if (isInterest)
          ledger.pastDueInterestPaid = ledger.pastDueInterestPaid.add(amount);
        else ledger.penaltyPaid = ledger.penaltyPaid.add(amount);
      } else {
        if (isInterest)
          ledger.pastDueInterestPaid = ledger.pastDueInterestPaid.sub(amount);
        else ledger.penaltyPaid = ledger.penaltyPaid.sub(amount);
      }
    }

    const summary = {
      penaltyAccrued: moneyNumber(loan.penaltyAccrued),
      penaltyPaid: moneyNumber(loan.penaltyPaid),
      penaltyWaived: moneyNumber(loan.penaltyWaived),
      pastDueInterestAccrued: moneyNumber(loan.pastDueInterestAccrued),
      pastDueInterestPaid: moneyNumber(loan.pastDueInterestPaid),
      pastDueInterestWaived: moneyNumber(loan.pastDueInterestWaived),
    };
    const ledgerNumbers = {
      penaltyAccrued: moneyNumber(ledger.penaltyAccrued),
      penaltyPaid: moneyNumber(ledger.penaltyPaid),
      penaltyWaived: moneyNumber(ledger.penaltyWaived),
      pastDueInterestAccrued: moneyNumber(ledger.pastDueInterestAccrued),
      pastDueInterestPaid: moneyNumber(ledger.pastDueInterestPaid),
      pastDueInterestWaived: moneyNumber(ledger.pastDueInterestWaived),
    };
    const reconciled = Object.keys(summary).every((key) => {
      const field = key as keyof typeof summary;
      return money(summary[field]).eq(ledgerNumbers[field]);
    });

    return { loanId, reconciled, summary, ledger: ledgerNumbers };
  }

  async postDueChargesForLoan(
    loanId: string,
    asOfDate: string,
    manager?: EntityManager,
    resolvingRepayment?: ResolvingRepayment,
  ): Promise<ChargePostingResult> {
    const normalizedAsOfDate = parseDateOnly(asOfDate).value;
    if (!manager) {
      return this.loanRepository.manager.transaction((transactionManager) =>
        this.postDueChargesForLoan(
          loanId,
          normalizedAsOfDate,
          transactionManager,
          resolvingRepayment,
        ),
      );
    }

    const loanRepository = manager.getRepository(Loan);
    await loanRepository
      .createQueryBuilder('loan')
      .setLock('pessimistic_write')
      .where('loan.id = :loanId', { loanId })
      .getOne();
    const loan = await loanRepository.findOne({ where: { id: loanId } });
    if (!loan) throw new NotFoundException(`Loan #${loanId} not found`);
    if (
      loan.status !== 'active' ||
      !this.policyService.isEligible(loan, normalizedAsOfDate)
    ) {
      return { chargeCount: 0, skippedPendingCount: 0 };
    }

    const schedules = await manager.getRepository(LoanRepaymentSchedule).find({
      where: { loanId },
      relations: ['allocations', 'allocations.repayment'],
      order: { dueDate: 'ASC', weekNumber: 'ASC' },
    });
    if (!schedules.length) {
      throw new BadRequestException(
        `Eligible loan #${loanId} has no repayment schedule`,
      );
    }
    const existingKeys = new Set(
      (
        await manager.getRepository(LoanChargeLedger).find({
          where: { loanId },
          select: ['idempotencyKey'],
        })
      ).map((entry) => entry.idempotencyKey),
    );

    const maturityDate = schedules[schedules.length - 1].dueDate;
    let chargeCount = 0;
    let skippedPendingCount = 0;
    let projectedContractualFunds = this.getProjectedContractualFunds(
      loan,
      resolvingRepayment,
    );

    for (const schedule of schedules) {
      const assessmentDate = getWeeklyPenaltyAssessmentDate(schedule.dueDate);
      if (
        assessmentDate > normalizedAsOfDate ||
        assessmentDate > maturityDate ||
        assessmentDate < loan.overdueChargePolicyEffectiveDate!
      ) {
        continue;
      }

      const cutoffDate = addDaysToDateOnly(parseDateOnly(assessmentDate), -1);
      if (
        await this.hasPendingOnTimePayment(
          loanId,
          cutoffDate,
          manager,
          resolvingRepayment?.id,
        )
      ) {
        skippedPendingCount += 1;
        continue;
      }
      const paid = this.getSchedulePaidAsOf(schedule, cutoffDate);
      const due = money(schedule.amountDue);
      const shortfall = Decimal.max(0, due.sub(paid));
      const canProjectRepayment =
        resolvingRepayment?.collectionDate !== undefined &&
        resolvingRepayment.collectionDate <= cutoffDate;
      if (canProjectRepayment && projectedContractualFunds.gte(shortfall)) {
        projectedContractualFunds = projectedContractualFunds.sub(shortfall);
        continue;
      }
      if (paid.gte(due)) {
        continue;
      }

      const penalty = calculateWeeklyPenalty(loan.weeklyPaymentAmount);
      const created = await this.createLedgerEntryIfMissing(
        {
          loanId,
          scheduleId: schedule.id,
          policyVersion: OVERDUE_CHARGE_POLICY_V1,
          chargeType: LoanChargeType.WEEKLY_PENALTY,
          eventType: LoanChargeLedgerEventType.ACCRUAL,
          amount: moneyString(penalty),
          cashPortion: '0.00',
          savingsPortion: '0.00',
          baseAmount: moneyString(loan.weeklyPaymentAmount),
          rate: '0.00000000',
          periodStart: schedule.dueDate,
          periodEnd: cutoffDate,
          sourceRepaymentId: null,
          reversedLedgerEntryId: null,
          idempotencyKey: `loan-charge:v1:${loanId}:weekly:${schedule.id}`,
          metadata: { assessmentDate, cutoffDate },
        },
        manager,
        existingKeys,
      );
      if (created) {
        loan.penaltyAccrued = moneyNumber(
          decimal(loan.penaltyAccrued).add(penalty),
        );
        chargeCount += 1;
      }
      if (canProjectRepayment) {
        if (created) {
          projectedContractualFunds = Decimal.max(
            0,
            projectedContractualFunds.sub(penalty),
          );
        }
        projectedContractualFunds = Decimal.max(
          0,
          projectedContractualFunds.sub(shortfall),
        );
      }
    }

    const maturityStart = addDaysToDateOnly(parseDateOnly(maturityDate), 1);
    const firstMaturityChargeDate = laterDateOnly(
      maturityStart,
      loan.overdueChargePolicyEffectiveDate!,
    );
    const maturityReached = firstMaturityChargeDate <= normalizedAsOfDate;
    const maturityDeferred = maturityReached
      ? await this.hasPendingOnTimePayment(
          loanId,
          normalizedAsOfDate,
          manager,
          resolvingRepayment?.id,
        )
      : false;
    if (maturityDeferred) skippedPendingCount += 1;
    if (!maturityDeferred && maturityReached) {
      const projectedContractualAmount = resolvingRepayment
        ? this.previewPaymentAllocation(
            loan,
            resolvingRepayment.cashAmount,
            resolvingRepayment.useSavings,
          ).contractual.amount
        : 0;
      const maturityPrincipal = this.getRemainingPrincipalAsOf(
        schedules,
        maturityDate,
        resolvingRepayment,
        projectedContractualAmount,
      );
      if (maturityPrincipal.gt(0)) {
        const maturityPenalty = calculateMaturityPenalty(maturityPrincipal);
        const created = await this.createLedgerEntryIfMissing(
          {
            loanId,
            scheduleId: null,
            policyVersion: OVERDUE_CHARGE_POLICY_V1,
            chargeType: LoanChargeType.MATURITY_PENALTY,
            eventType: LoanChargeLedgerEventType.ACCRUAL,
            amount: moneyString(maturityPenalty),
            cashPortion: '0.00',
            savingsPortion: '0.00',
            baseAmount: moneyString(maturityPrincipal),
            rate: MATURITY_PENALTY_RATE.toFixed(8),
            periodStart: maturityStart,
            periodEnd: maturityStart,
            sourceRepaymentId: null,
            reversedLedgerEntryId: null,
            idempotencyKey: `loan-charge:v1:${loanId}:maturity-penalty`,
            metadata: { maturityDate },
          },
          manager,
          existingKeys,
        );
        if (created) {
          loan.penaltyAccrued = moneyNumber(
            decimal(loan.penaltyAccrued).add(maturityPenalty),
          );
          chargeCount += 1;
        }
      }

      let interestDate = firstMaturityChargeDate;
      while (interestDate <= normalizedAsOfDate) {
        const dailyPrincipal = this.getRemainingPrincipalAsOf(
          schedules,
          interestDate,
          resolvingRepayment,
          projectedContractualAmount,
        );
        if (dailyPrincipal.gt(0)) {
          const interest = calculatePastDueInterest(dailyPrincipal, 1);
          const created = await this.createLedgerEntryIfMissing(
            {
              loanId,
              scheduleId: null,
              policyVersion: OVERDUE_CHARGE_POLICY_V1,
              chargeType: LoanChargeType.PAST_DUE_INTEREST,
              eventType: LoanChargeLedgerEventType.ACCRUAL,
              amount: moneyString(interest),
              cashPortion: '0.00',
              savingsPortion: '0.00',
              baseAmount: moneyString(dailyPrincipal),
              rate: PAST_DUE_MONTHLY_INTEREST_RATE.toFixed(8),
              periodStart: interestDate,
              periodEnd: interestDate,
              sourceRepaymentId: null,
              reversedLedgerEntryId: null,
              idempotencyKey: `loan-charge:v1:${loanId}:pdi:${interestDate}`,
              metadata: { maturityDate, dayDivisor: 30 },
            },
            manager,
            existingKeys,
          );
          if (created) {
            loan.pastDueInterestAccrued = moneyNumber(
              decimal(loan.pastDueInterestAccrued).add(interest),
            );
            chargeCount += 1;
          }
        }
        interestDate = addDaysToDateOnly(parseDateOnly(interestDate), 1);
      }
    }

    if (chargeCount > 0) await loanRepository.save(loan);
    return { chargeCount, skippedPendingCount };
  }

  async postDueChargesForEligibleLoans(
    asOfDate: string,
    batchSize = 100,
  ): Promise<LoanChargeSweepResult> {
    const normalizedAsOfDate = parseDateOnly(asOfDate).value;
    const result: LoanChargeSweepResult = {
      asOfDate: normalizedAsOfDate,
      scannedCount: 0,
      processedCount: 0,
      chargeCount: 0,
      skippedPendingCount: 0,
      failedCount: 0,
      failures: [],
    };
    let lastId: string | null = null;

    while (true) {
      const query = this.loanRepository
        .createQueryBuilder('loan')
        .select('loan.id', 'id')
        .where('loan.status = :status', { status: 'active' })
        .andWhere('loan.overdueChargePolicyVersion = :version', {
          version: OVERDUE_CHARGE_POLICY_V1,
        })
        .andWhere('loan.overdueChargePolicyEffectiveDate <= :asOfDate', {
          asOfDate: normalizedAsOfDate,
        })
        .orderBy('loan.id', 'ASC')
        .take(batchSize);
      if (lastId) query.andWhere('loan.id > :lastId', { lastId });
      const rows = await query.getRawMany<{ id: string }>();
      if (!rows.length) break;

      for (const row of rows) {
        result.scannedCount += 1;
        try {
          const posted = await this.postDueChargesForLoan(
            row.id,
            normalizedAsOfDate,
          );
          result.processedCount += 1;
          result.chargeCount += posted.chargeCount;
          result.skippedPendingCount += posted.skippedPendingCount;
        } catch (error) {
          result.failedCount += 1;
          result.failures.push({
            loanId: row.id,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
      lastId = rows[rows.length - 1].id;
      if (rows.length < batchSize) break;
    }

    return result;
  }

  private async hasPendingOnTimePayment(
    loanId: string,
    cutoffDate: string,
    manager: EntityManager,
    excludedRepaymentId?: string,
  ): Promise<boolean> {
    return manager.getRepository(Repayment).exists({
      where: {
        ...(excludedRepaymentId ? { id: Not(excludedRepaymentId) } : {}),
        loan: { id: loanId },
        status: RepaymentStatus.PENDING,
        operationType: RepaymentOperationType.PAYMENT,
        collectionDate: LessThanOrEqual(cutoffDate),
      },
    });
  }

  private getProjectedContractualFunds(
    loan: Loan,
    repayment?: ResolvingRepayment,
  ): Decimal {
    if (!repayment) return new Decimal(0);
    return money(
      this.previewPaymentAllocation(
        loan,
        repayment.cashAmount,
        repayment.useSavings,
      ).contractual.amount,
    );
  }

  private async recordPenaltyPayment(
    loan: Loan,
    repaymentId: string,
    allocation: PaymentBucketAllocation,
    manager: EntityManager,
  ): Promise<Decimal> {
    let remaining = money(allocation.amount);
    let cashRemaining = money(allocation.cashPortion);
    let savingsRemaining = money(allocation.savingsPortion);
    let createdTotal = new Decimal(0);
    const balances = await this.getPenaltyOutstandingByType(loan, manager);

    for (const chargeType of PENALTY_CHARGE_TYPES) {
      if (remaining.lte(0)) break;
      const amount = Decimal.min(remaining, balances[chargeType]);
      if (amount.lte(0)) continue;
      const cashPortion = Decimal.min(cashRemaining, amount);
      const savingsPortion = amount.sub(cashPortion);
      const created = await this.createLedgerEntryIfMissing(
        {
          loanId: loan.id,
          scheduleId: null,
          policyVersion: OVERDUE_CHARGE_POLICY_V1,
          chargeType,
          eventType: LoanChargeLedgerEventType.PAYMENT,
          amount: moneyString(amount),
          cashPortion: moneyString(cashPortion),
          savingsPortion: moneyString(savingsPortion),
          baseAmount: '0.00',
          rate: '0.00000000',
          periodStart: null,
          periodEnd: null,
          sourceRepaymentId: repaymentId,
          reversedLedgerEntryId: null,
          idempotencyKey: `loan-charge:v1:${loan.id}:repayment:${repaymentId}:${chargeType}`,
          metadata: null,
        },
        manager,
      );
      if (created) createdTotal = createdTotal.add(amount);
      remaining = remaining.sub(amount);
      cashRemaining = cashRemaining.sub(cashPortion);
      savingsRemaining = savingsRemaining.sub(savingsPortion);
    }

    return money(createdTotal);
  }

  private async recordSingleChargePayment(
    loan: Loan,
    repaymentId: string,
    chargeType: LoanChargeType,
    allocation: PaymentBucketAllocation,
    manager: EntityManager,
  ): Promise<Decimal> {
    const amount = money(allocation.amount);
    if (amount.lte(0)) return new Decimal(0);
    const created = await this.createLedgerEntryIfMissing(
      {
        loanId: loan.id,
        scheduleId: null,
        policyVersion: OVERDUE_CHARGE_POLICY_V1,
        chargeType,
        eventType: LoanChargeLedgerEventType.PAYMENT,
        amount: moneyString(amount),
        cashPortion: moneyString(allocation.cashPortion),
        savingsPortion: moneyString(allocation.savingsPortion),
        baseAmount: '0.00',
        rate: '0.00000000',
        periodStart: null,
        periodEnd: null,
        sourceRepaymentId: repaymentId,
        reversedLedgerEntryId: null,
        idempotencyKey: `loan-charge:v1:${loan.id}:repayment:${repaymentId}:${chargeType}`,
        metadata: null,
      },
      manager,
    );
    return created ? amount : new Decimal(0);
  }

  private async getPenaltyOutstandingByType(
    loan: Loan,
    manager: EntityManager,
  ): Promise<Record<PenaltyChargeType, Decimal>> {
    const entries = await manager.getRepository(LoanChargeLedger).find({
      where: { loanId: loan.id },
    });
    const balances: Record<PenaltyChargeType, Decimal> = {
      [LoanChargeType.WEEKLY_PENALTY]: new Decimal(0),
      [LoanChargeType.MATURITY_PENALTY]: new Decimal(0),
    };
    for (const entry of entries) {
      if (entry.chargeType === LoanChargeType.PAST_DUE_INTEREST) continue;
      const amount = money(entry.amount);
      if (entry.eventType === LoanChargeLedgerEventType.ACCRUAL) {
        balances[entry.chargeType] = balances[entry.chargeType].add(amount);
      } else if (entry.eventType === LoanChargeLedgerEventType.PAYMENT) {
        balances[entry.chargeType] = balances[entry.chargeType].sub(amount);
      } else {
        balances[entry.chargeType] = balances[entry.chargeType].add(amount);
      }
    }

    let waived = money(loan.penaltyWaived);
    for (const chargeType of PENALTY_CHARGE_TYPES) {
      const applied = Decimal.min(waived, Decimal.max(0, balances[chargeType]));
      balances[chargeType] = Decimal.max(0, balances[chargeType].sub(applied));
      waived = waived.sub(applied);
    }
    return balances;
  }

  private getSchedulePaidAsOf(
    schedule: LoanRepaymentSchedule,
    asOfDate: string,
  ): Decimal {
    return (schedule.allocations ?? []).reduce((total, allocation) => {
      const repayment = allocation.repayment;
      if (
        !repayment ||
        repayment.status !== RepaymentStatus.APPROVED ||
        repayment.operationType !== RepaymentOperationType.PAYMENT ||
        !repayment.paymentDate ||
        repayment.paymentDate > asOfDate
      ) {
        return total;
      }
      return total.add(allocation.amountApplied);
    }, new Decimal(0));
  }

  private getRemainingPrincipalAsOf(
    schedules: LoanRepaymentSchedule[],
    asOfDate: string,
    resolvingRepayment?: ResolvingRepayment,
    projectedContractualAmount = 0,
  ): Decimal {
    const principalDue = schedules.reduce(
      (total, schedule) => total.add(schedule.principalDue),
      new Decimal(0),
    );
    const principalPaid = schedules.reduce(
      (total, schedule) =>
        total.add(
          (schedule.allocations ?? []).reduce((scheduleTotal, allocation) => {
            const repayment = allocation.repayment;
            if (
              !repayment ||
              repayment.status !== RepaymentStatus.APPROVED ||
              repayment.operationType !== RepaymentOperationType.PAYMENT ||
              !repayment.paymentDate ||
              repayment.paymentDate > asOfDate
            ) {
              return scheduleTotal;
            }
            return scheduleTotal.add(allocation.principalPortion);
          }, new Decimal(0)),
        ),
      new Decimal(0),
    );
    const projectedPrincipal =
      resolvingRepayment && resolvingRepayment.collectionDate <= asOfDate
        ? this.getProjectedPrincipalPaid(
            schedules,
            resolvingRepayment.collectionDate,
            projectedContractualAmount,
          )
        : new Decimal(0);
    return money(
      Decimal.max(0, principalDue.sub(principalPaid).sub(projectedPrincipal)),
    );
  }

  private getProjectedPrincipalPaid(
    schedules: LoanRepaymentSchedule[],
    paymentDate: string,
    contractualAmount: number,
  ): Decimal {
    let remaining = money(contractualAmount);
    let principal = new Decimal(0);

    for (const schedule of schedules) {
      if (remaining.lte(0)) break;
      const paidAsOf = this.getSchedulePaidAsOf(schedule, paymentDate);
      const shortfall = Decimal.max(0, money(schedule.amountDue).sub(paidAsOf));
      const applied = Decimal.min(shortfall, remaining);
      if (applied.lte(0)) continue;
      const split = getRealizedAllocationSplit(
        {
          amountPaid: moneyNumber(paidAsOf),
          interestDue: schedule.interestDue,
          principalDue: schedule.principalDue,
        },
        moneyNumber(applied),
      );
      principal = principal.add(split.principalPortion);
      remaining = remaining.sub(applied);
    }

    return money(principal);
  }

  private async createLedgerEntryIfMissing(
    value: NewLedgerEntry,
    manager: EntityManager,
    existingKeys?: Set<string>,
  ): Promise<boolean> {
    const repository = manager.getRepository(LoanChargeLedger);
    if (existingKeys) {
      if (existingKeys.has(value.idempotencyKey)) return false;
    } else {
      const exists = await repository.exists({
        where: { idempotencyKey: value.idempotencyKey },
      });
      if (exists) return false;
    }
    await repository.save(repository.create(value));
    existingKeys?.add(value.idempotencyKey);
    return true;
  }
}
