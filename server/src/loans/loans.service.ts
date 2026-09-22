import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { EntityManager, Repository } from 'typeorm';
import { Loan } from './loan.entity';
import { Member } from '../members/entities/member.entity';
import { Collection } from '../collections/entities/collection.entity';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { ReloanDto } from './dto/reloan.dto';
import { ApplyLoanWaiverDto } from './dto/apply-loan-waiver.dto';
import { FindMemberLoansQueryDto } from './dto/find-member-loans-query.dto';
import {
  LoanRepaymentSchedule,
  LoanRepaymentStatus,
} from '../repayments/entities/loan-repayment-schedule.entity';
import { Savings, SavingsEventType } from '../savings/savings.entity';
import { buildLoanRepaymentBreakdown } from '../repayments/loan-repayment-schedule.utils';
import { LoanWaiver } from './entities/loan-waiver.entity';
import { getFinancialBusinessDate } from '../common/financial-business-date';
import {
  loanContributionIdempotencyKey,
  repaymentSavingsDebitIdempotencyKey,
  SAVINGS_REFERENCE_TYPE,
} from '../savings/savings-ledger.utils';
import { LoanChargePolicyService } from './loan-charge-policy.service';
import { parseDateOnly } from '../common/date-only';
import {
  LoanChargesService,
  LoanPaymentAllocation,
} from './loan-charges.service';
import { decimal, moneyNumber } from '../common/money';

type LoanCreationOrigin = 'origination' | 'reloan';

interface LoanCreationContext {
  origin: LoanCreationOrigin;
  actorId?: string;
  businessDate: string;
}

interface RepaymentSavingsLedgerContext {
  repaymentId: string;
  actorId?: string;
  businessDate: string;
}

export interface LoanRepaymentApplicationResult {
  loan: Loan;
  allocation: LoanPaymentAllocation;
}

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    @InjectRepository(Savings)
    private readonly savingsRepository: Repository<Savings>,
    @InjectRepository(LoanRepaymentSchedule)
    private readonly scheduleRepository: Repository<LoanRepaymentSchedule>,
    @InjectRepository(LoanWaiver)
    private readonly loanWaiverRepository: Repository<LoanWaiver>,
    private readonly loanChargePolicyService: LoanChargePolicyService,
    private readonly loanChargesService: LoanChargesService,
  ) {}

  // Business logic for interest rates
  private getInterestRate(
    termWeeks: number,
    monthlyInterestRate?: number,
  ): number {
    if (termWeeks === 4) return 0.1;
    if (termWeeks === 8) return 0.2;
    if (termWeeks === 12) return 0.3;

    if (termWeeks !== 24) {
      throw new BadRequestException('termWeeks must be 4, 8, 12, or 24');
    }

    const rate = Number(monthlyInterestRate);
    if (!Number.isFinite(rate) || rate < 3.33 || rate > 10) {
      throw new BadRequestException(
        'monthlyInterestRate is required for 24-week loans and must be between 3.33 and 10',
      );
    }

    return (rate * 6) / 100;
  }

  // Calculate loan details
  private calculateLoanDetails(
    principalAmount: number,
    termWeeks: number,
    monthlyInterestRate?: number,
  ) {
    if (termWeeks !== 24 && monthlyInterestRate !== undefined) {
      throw new BadRequestException(
        'monthlyInterestRate is only allowed for 24-week loans',
      );
    }

    const interestRate = this.getInterestRate(termWeeks, monthlyInterestRate);
    const totalInterest = principalAmount * interestRate;
    const totalAmount = principalAmount + totalInterest;
    const baseWeeklyPayment = totalAmount / termWeeks;
    const roundedWeeklyPayment = Math.floor(baseWeeklyPayment / 10) * 10;
    const weeklyPaymentAmount =
      termWeeks === 12 || termWeeks === 24
        ? roundedWeeklyPayment + 10
        : roundedWeeklyPayment;

    return {
      interestRate,
      totalInterest,
      totalAmount,
      weeklyPaymentAmount,
    };
  }

  async findAuthoritativeSavingsLoanForMember(
    borrowerId: string,
    manager?: EntityManager,
  ): Promise<Loan | null> {
    const repository = manager?.getRepository(Loan) ?? this.loanRepository;
    const activeLoans = await repository.find({
      where: { borrower: { id: borrowerId }, status: 'active' },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 2,
    });

    if (activeLoans.length > 1) {
      throw new ConflictException(
        'Authoritative savings balance is ambiguous because the member has multiple active loans',
      );
    }
    if (activeLoans.length === 1) {
      return activeLoans[0];
    }

    const latestLoans = await repository.find({
      where: { borrower: { id: borrowerId } },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 2,
    });

    if (latestLoans.length === 0) {
      return null;
    }
    if (
      latestLoans.length > 1 &&
      latestLoans[0].createdAt.getTime() === latestLoans[1].createdAt.getTime()
    ) {
      throw new ConflictException(
        'Authoritative savings balance is ambiguous because the latest loans have the same creation time',
      );
    }

    return latestLoans[0];
  }

  async create(createLoanDto: CreateLoanDto, actorId?: string): Promise<Loan> {
    return this.loanRepository.manager.transaction((manager) =>
      this.createLoanWithinTransaction(
        createLoanDto,
        {
          origin: 'origination',
          actorId,
          businessDate: getFinancialBusinessDate(),
        },
        manager,
      ),
    );
  }

  private async createLoanWithinTransaction(
    createLoanDto: CreateLoanDto,
    context: LoanCreationContext,
    manager: EntityManager,
  ): Promise<Loan> {
    const {
      borrowerId,
      principalAmount,
      termWeeks,
      savings,
      serviceCharge,
      notarialFee,
      loanCreatedDate,
      monthlyInterestRate,
    } = createLoanDto;

    // Check if borrower exists
    const memberRepository = manager.getRepository(Member);
    const loanRepository = manager.getRepository(Loan);
    const collectionRepository = manager.getRepository(Collection);
    const savingsRepository = manager.getRepository(Savings);

    const borrower = await memberRepository.findOne({
      where: { id: borrowerId },
      relations: ['center'],
    });
    if (!borrower) {
      throw new NotFoundException(`Member #${borrowerId} not found`);
    }

    const latestLoan = await this.findAuthoritativeSavingsLoanForMember(
      String(borrowerId),
      manager,
    );
    if (latestLoan?.status === 'active') {
      throw new BadRequestException('Member already has an active loan');
    }

    // Determine if this is the borrower's first loan (no prior loans at all)
    const isFirstLoan = !latestLoan;

    // Validate savings per business rule
    const providedSavings =
      savings !== undefined && savings !== null ? Number(savings) : undefined;
    if (
      providedSavings !== undefined &&
      (isNaN(providedSavings) || providedSavings < 0)
    ) {
      throw new BadRequestException('savings must be >= 0 when provided');
    }

    const previousSavingsTotal = latestLoan
      ? Number(latestLoan.savings || 0)
      : 0;
    const newSavingsContribution = Number(providedSavings ?? 0);

    // Validate service charge if provided
    const fee =
      serviceCharge !== undefined && serviceCharge !== null
        ? Number(serviceCharge)
        : 0;
    if (isNaN(fee) || fee < 0) {
      throw new BadRequestException('serviceCharge must be >= 0 when provided');
    }
    const legalFee =
      notarialFee !== undefined && notarialFee !== null
        ? Number(notarialFee)
        : 0;
    if (isNaN(legalFee) || legalFee < 0) {
      throw new BadRequestException('notarialFee must be >= 0 when provided');
    }
    const totalSavingsForValidation =
      previousSavingsTotal + newSavingsContribution;
    if (isFirstLoan && newSavingsContribution <= 0) {
      throw new BadRequestException(
        'Savings contribution must be greater than 0 for the first loan',
      );
    }

    // Calculate loan details (no auto-10% savings)
    const { interestRate, totalAmount, weeklyPaymentAmount } =
      this.calculateLoanDetails(
        principalAmount,
        termWeeks,
        monthlyInterestRate,
      );

    const releaseDate = loanCreatedDate
      ? parseDateOnly(loanCreatedDate).value
      : context.businessDate;
    const chargePolicyEnrollment =
      this.loanChargePolicyService.resolveEnrollment(releaseDate);

    // Create loan
    const loan = loanRepository.create({
      borrower,
      principalAmount,
      termWeeks,
      interestRate,
      totalAmount,
      serviceCharge: fee,
      notarialFee: legalFee,
      weeklyPaymentAmount,
      balance: totalAmount,
      savings: totalSavingsForValidation,
      existingSavings: 0,
      weeksPaid: 0,
      paymentCountDisplayOffset: 1,
      amountPaid: 0,
      advancePaymentBuffer: 0,
      status: 'active',
      loanCreatedDate: new Date(`${releaseDate}T00:00:00.000Z`),
      overdueChargePolicyVersion: chargePolicyEnrollment?.version ?? null,
      overdueChargePolicyEffectiveDate:
        chargePolicyEnrollment?.effectiveDate ?? null,
    });

    // Compute net cash released for all loans: principal - fee - savings (never below 0)
    const savingsForCalc = newSavingsContribution;
    const net = Number(principalAmount) - fee - legalFee - savingsForCalc;
    const netCashReleased = net > 0 ? net : 0;
    loan.netCashReleased = netCashReleased;

    const savedLoan = await loanRepository.save(loan);

    if (chargePolicyEnrollment) {
      await this.rebuildRepaymentSchedule(savedLoan, borrower, manager);
    }

    if (newSavingsContribution > 0) {
      const eventType =
        context.origin === 'reloan'
          ? SavingsEventType.RELOAN_CONTRIBUTION
          : SavingsEventType.LOAN_ORIGINATION_CONTRIBUTION;
      const savingsEntry = savingsRepository.create({
        borrower,
        loan: savedLoan,
        eventType,
        amount: newSavingsContribution,
        balanceBefore: previousSavingsTotal,
        balanceAfter: totalSavingsForValidation,
        businessDate: context.businessDate,
        referenceType: SAVINGS_REFERENCE_TYPE.LOAN,
        referenceId: savedLoan.id,
        idempotencyKey: loanContributionIdempotencyKey(savedLoan.id, eventType),
        performedById: context.actorId ?? null,
        reversalOfId: null,
        remarks:
          context.origin === 'reloan'
            ? 'Savings contribution on reloan'
            : 'Savings contribution on loan origination',
      });
      await savingsRepository.save(savingsEntry);
    }

    // Reset any existing collections' paymentReceived to 0 for this member
    await collectionRepository.update(
      { memberId: borrowerId },
      { paymentReceived: 0 },
    );

    return savedLoan;
  }

  /**
   * Apply a repayment amount to a loan. Handles weekly payment counting and advance buffer.
   * If payment is short of weekly amount, deducts from savings to cover the difference.
   */
  async applyRepayment(
    loanId: string,
    amount: number,
    useSavings: boolean = false,
    manager?: EntityManager,
    ledgerContext?: RepaymentSavingsLedgerContext,
  ): Promise<Loan> {
    const result = await this.applyRepaymentWithAllocation(
      loanId,
      amount,
      useSavings,
      manager,
      ledgerContext,
    );
    return result.loan;
  }

  async applyRepaymentWithAllocation(
    loanId: string,
    amount: number,
    useSavings: boolean = false,
    manager?: EntityManager,
    ledgerContext?: RepaymentSavingsLedgerContext,
  ): Promise<LoanRepaymentApplicationResult> {
    if (
      amount === undefined ||
      amount === null ||
      Number.isNaN(Number(amount))
    ) {
      throw new BadRequestException('Payment amount must be provided');
    }

    const cashAmount = Number(amount);
    if (cashAmount < 0) {
      throw new BadRequestException('Payment amount must be >= 0');
    }

    if (cashAmount === 0 && !useSavings) {
      throw new BadRequestException(
        'Payment amount must be greater than zero when not using savings',
      );
    }

    if (!manager) {
      return this.loanRepository.manager.transaction((transactionManager) =>
        this.applyRepaymentWithAllocation(
          loanId,
          amount,
          useSavings,
          transactionManager,
          ledgerContext,
        ),
      );
    }

    const loanRepository = manager.getRepository(Loan);
    const savingsRepository = manager.getRepository(Savings);
    await loanRepository
      .createQueryBuilder('loan')
      .setLock('pessimistic_write')
      .where('loan.id = :loanId', { loanId })
      .getOne();
    const loan = await loanRepository.findOne({
      where: { id: loanId },
      relations: ['borrower'],
    });
    if (!loan) {
      throw new NotFoundException(`Loan #${loanId} not found`);
    }
    if (loan.status !== 'active') {
      throw new BadRequestException('Cannot pay a non-active loan');
    }

    const weekly = Number(loan.weeklyPaymentAmount);
    const expectedPayment = Math.min(weekly, Number(loan.balance));
    const currentBuffer = Number(loan.advancePaymentBuffer || 0);
    const availableSavings = Number(loan.savings || 0);
    const chargePolicyEligible = this.loanChargePolicyService.isEligible(loan);

    if (chargePolicyEligible && !ledgerContext) {
      throw new Error(
        'Repayment ledger context is required for a policy-enrolled loan',
      );
    }

    // If payment is short and useSavings is true, deduct from savings
    let totalPayment = cashAmount;
    let savingsUsed = 0;
    let allocation: LoanPaymentAllocation = {
      eligible: false,
      cashReceived: cashAmount,
      savingsUsed: 0,
      totalApplied: cashAmount,
      penalty: { amount: 0, cashPortion: 0, savingsPortion: 0 },
      pastDueInterest: { amount: 0, cashPortion: 0, savingsPortion: 0 },
      contractual: {
        amount: cashAmount,
        cashPortion: cashAmount,
        savingsPortion: 0,
      },
      unapplied: 0,
    };

    if (chargePolicyEligible) {
      allocation = this.loanChargesService.previewPaymentAllocation(
        loan,
        cashAmount,
        useSavings,
      );
      if (allocation.totalApplied <= 0) {
        throw new BadRequestException(
          'No cash or savings is available to apply to this loan',
        );
      }
      if (allocation.unapplied > 0) {
        throw new BadRequestException(
          `Payment exceeds the total outstanding amount by ${allocation.unapplied.toFixed(2)}`,
        );
      }
      await this.loanChargesService.recordPaymentAllocation(
        loan,
        ledgerContext!.repaymentId,
        allocation,
        manager,
      );
      totalPayment = allocation.contractual.amount;
      savingsUsed = allocation.savingsUsed;
    } else if (useSavings && cashAmount < expectedPayment) {
      const shortfall = expectedPayment - cashAmount;
      if (availableSavings <= 0) {
        throw new BadRequestException(
          'No savings available to cover the payment shortfall',
        );
      }

      const required = Math.min(shortfall, availableSavings);
      savingsUsed = required;
      totalPayment = cashAmount + required;
      totalPayment = Math.min(totalPayment, expectedPayment);
    }

    if (!chargePolicyEligible) {
      const contractualCash = Math.min(cashAmount, totalPayment);
      allocation = {
        eligible: false,
        cashReceived: cashAmount,
        savingsUsed,
        totalApplied: totalPayment,
        penalty: { amount: 0, cashPortion: 0, savingsPortion: 0 },
        pastDueInterest: { amount: 0, cashPortion: 0, savingsPortion: 0 },
        contractual: {
          amount: totalPayment,
          cashPortion: contractualCash,
          savingsPortion: Math.max(0, totalPayment - contractualCash),
        },
        unapplied: 0,
      };
    }

    const newBuffer = chargePolicyEligible
      ? moneyNumber(decimal(currentBuffer).add(totalPayment))
      : currentBuffer + totalPayment;
    const newWeeksPaid = Math.floor(newBuffer / weekly);
    const remainingBuffer = chargePolicyEligible
      ? moneyNumber(decimal(newBuffer).mod(weekly))
      : newBuffer % weekly;

    loan.weeksPaid = Number(loan.weeksPaid) + newWeeksPaid;
    loan.advancePaymentBuffer = remainingBuffer;
    loan.amountPaid = chargePolicyEligible
      ? moneyNumber(decimal(loan.amountPaid).add(totalPayment))
      : Number(loan.amountPaid) + totalPayment;
    loan.balance = chargePolicyEligible
      ? moneyNumber(Decimal.max(0, decimal(loan.balance).sub(totalPayment)))
      : Math.max(0, Number(loan.balance) - totalPayment);
    loan.savings = chargePolicyEligible
      ? moneyNumber(Decimal.max(0, decimal(availableSavings).sub(savingsUsed)))
      : Math.max(0, availableSavings - savingsUsed);
    loan.existingSavings = 0;

    const chargesOutstanding = chargePolicyEligible
      ? this.loanChargesService.getOutstanding(loan).totalOutstanding
      : 0;
    if (loan.balance === 0 && chargesOutstanding === 0) {
      loan.status = 'paid';
      loan.weeksPaid = Number(loan.termWeeks);
      loan.advancePaymentBuffer = 0;
    }

    const savedLoan = await loanRepository.save(loan);

    // Record savings deduction as a savings withdrawal transaction entry
    if (savingsUsed > 0) {
      if (!ledgerContext) {
        throw new Error(
          'Repayment savings ledger context is required for a savings debit',
        );
      }
      const savingsEntry = savingsRepository.create({
        borrower: loan.borrower,
        loan,
        amount: -Math.abs(savingsUsed),
        remarks: 'Applied to repayment',
        eventType: SavingsEventType.REPAYMENT_DEBIT,
        balanceBefore: availableSavings,
        balanceAfter: Number(savedLoan.savings),
        businessDate: ledgerContext.businessDate,
        referenceType: SAVINGS_REFERENCE_TYPE.REPAYMENT,
        referenceId: ledgerContext.repaymentId,
        idempotencyKey: repaymentSavingsDebitIdempotencyKey(
          ledgerContext.repaymentId,
        ),
        performedById: ledgerContext.actorId ?? null,
        reversalOfId: null,
      });
      await savingsRepository.save(savingsEntry);
    }

    return { loan: savedLoan, allocation };
  }

  async findAll(): Promise<Loan[]> {
    return this.loanRepository.find({
      relations: ['borrower'],
    });
  }

  async findByMember(memberId: string, query: FindMemberLoansQueryDto) {
    const { status = 'all', page = 1, limit = 10 } = query;

    const qb = this.loanRepository
      .createQueryBuilder('loan')
      .leftJoinAndSelect('loan.borrower', 'borrower')
      .where('borrower.id = :memberId', { memberId })
      .orderBy('loan.createdAt', 'DESC')
      .addOrderBy('loan.id', 'DESC');

    if (status !== 'all') {
      qb.andWhere('loan.status = :status', { status });
    }

    const normalizedLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const normalizedPage = Math.max(Number(page) || 1, 1);

    qb.skip((normalizedPage - 1) * normalizedLimit).take(normalizedLimit);

    const [items, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / normalizedLimit) || 1;

    return {
      items,
      total,
      page: normalizedPage,
      limit: normalizedLimit,
      totalPages,
    };
  }

  async findOne(id: string): Promise<Loan> {
    const loan = await this.loanRepository.findOne({
      where: { id },
      relations: ['borrower'],
    });
    if (!loan) {
      throw new NotFoundException(`Loan #${id} not found`);
    }
    return loan;
  }

  private roundCurrency(value: number): number {
    return Number(value.toFixed(2));
  }

  private getOutstandingWaiverBuckets(loan: Loan) {
    const pastDueInterestOutstanding = Decimal.max(
      0,
      decimal(loan.pastDueInterestAccrued)
        .sub(loan.pastDueInterestPaid)
        .sub(loan.pastDueInterestWaived),
    );
    const penaltyOutstanding = Decimal.max(
      0,
      decimal(loan.penaltyAccrued)
        .sub(loan.penaltyPaid)
        .sub(loan.penaltyWaived),
    );

    return {
      pastDueInterestOutstanding: moneyNumber(pastDueInterestOutstanding),
      penaltyOutstanding: moneyNumber(penaltyOutstanding),
      totalOutstanding: moneyNumber(
        pastDueInterestOutstanding.add(penaltyOutstanding),
      ),
    };
  }

  async getWaiverCandidates() {
    const loans = await this.loanRepository.find({
      where: { status: 'active' },
      relations: ['borrower'],
      order: { updatedAt: 'DESC' },
    });

    return loans
      .filter((loan) => this.loanChargePolicyService.isEligible(loan))
      .map((loan) => ({
        id: loan.id,
        borrower: loan.borrower,
        status: loan.status,
        balance: Number(loan.balance || 0),
        pastDueInterestAccrued: Number(loan.pastDueInterestAccrued || 0),
        pastDueInterestPaid: Number(loan.pastDueInterestPaid || 0),
        pastDueInterestWaived: Number(loan.pastDueInterestWaived || 0),
        penaltyAccrued: Number(loan.penaltyAccrued || 0),
        penaltyPaid: Number(loan.penaltyPaid || 0),
        penaltyWaived: Number(loan.penaltyWaived || 0),
        overdueChargePolicyVersion: loan.overdueChargePolicyVersion,
        overdueChargePolicyEffectiveDate: loan.overdueChargePolicyEffectiveDate,
        ...this.getOutstandingWaiverBuckets(loan),
        updatedAt: loan.updatedAt,
      }))
      .filter((loan) => loan.totalOutstanding > 0);
  }

  async getWaiversByLoan(loanId: string): Promise<LoanWaiver[]> {
    await this.findOne(loanId);
    return this.loanWaiverRepository.find({
      where: { loanId },
      order: { createdAt: 'DESC' },
    });
  }

  async applyWaiver(loanId: string, dto: ApplyLoanWaiverDto, actorId?: string) {
    return this.loanRepository.manager.transaction((manager) =>
      this.applyWaiverWithinTransaction(loanId, dto, actorId, manager),
    );
  }

  private async applyWaiverWithinTransaction(
    loanId: string,
    dto: ApplyLoanWaiverDto,
    actorId: string | undefined,
    manager: EntityManager,
  ) {
    const loanRepository = manager.getRepository(Loan);
    const waiverRepository = manager.getRepository(LoanWaiver);
    await loanRepository
      .createQueryBuilder('loan')
      .setLock('pessimistic_write')
      .where('loan.id = :loanId', { loanId })
      .getOne();
    const loan = await loanRepository.findOne({
      where: { id: loanId },
      relations: ['borrower'],
    });
    if (!loan) throw new NotFoundException(`Loan #${loanId} not found`);
    if (loan.status !== 'active') {
      throw new BadRequestException(
        'Waiver can only be applied to active loans',
      );
    }

    const requestedPastDueInterestWaiver = moneyNumber(
      dto.pastDueInterestWaiver,
    );
    const requestedPenaltyWaiver = moneyNumber(dto.penaltyWaiver);

    if (requestedPastDueInterestWaiver <= 0 && requestedPenaltyWaiver <= 0) {
      throw new BadRequestException(
        'At least one waiver amount must be greater than 0',
      );
    }

    const { pastDueInterestOutstanding, penaltyOutstanding } =
      this.getOutstandingWaiverBuckets(loan);

    if (requestedPastDueInterestWaiver > pastDueInterestOutstanding) {
      throw new BadRequestException(
        `Past due interest waiver exceeds outstanding amount (${pastDueInterestOutstanding.toFixed(
          2,
        )})`,
      );
    }

    if (requestedPenaltyWaiver > penaltyOutstanding) {
      throw new BadRequestException(
        `Penalty waiver exceeds outstanding amount (${penaltyOutstanding.toFixed(2)})`,
      );
    }

    const policyEligible = this.loanChargePolicyService.isEligible(loan);
    if (!policyEligible) {
      throw new BadRequestException(
        'Legacy loans are not eligible for automated charge waivers',
      );
    }
    const beforeContractualBalance = Number(loan.balance || 0);
    const beforeBalance = this.roundCurrency(
      beforeContractualBalance +
        pastDueInterestOutstanding +
        penaltyOutstanding,
    );
    const totalWaived = this.roundCurrency(
      requestedPastDueInterestWaiver + requestedPenaltyWaiver,
    );

    loan.pastDueInterestWaived = moneyNumber(
      decimal(loan.pastDueInterestWaived).add(requestedPastDueInterestWaiver),
    );
    loan.penaltyWaived = moneyNumber(
      decimal(loan.penaltyWaived).add(requestedPenaltyWaiver),
    );
    const remainingCharges = this.getOutstandingWaiverBuckets(loan);
    if (loan.balance === 0 && remainingCharges.totalOutstanding === 0) {
      loan.status = 'paid';
    }

    const savedLoan = await loanRepository.save(loan);
    const afterBalance = this.roundCurrency(
      Number(savedLoan.balance || 0) + remainingCharges.totalOutstanding,
    );
    const waiver = waiverRepository.create({
      loanId: savedLoan.id,
      pastDueInterestWaived: this.roundCurrency(requestedPastDueInterestWaiver),
      penaltyWaived: this.roundCurrency(requestedPenaltyWaiver),
      totalWaived,
      waivedById: actorId ?? null,
      reason: dto.reason?.trim() || null,
      beforeBalance: this.roundCurrency(beforeBalance),
      afterBalance,
    });
    const savedWaiver = await waiverRepository.save(waiver);

    return {
      loan: savedLoan,
      waiver: savedWaiver,
      ...this.getOutstandingWaiverBuckets(savedLoan),
    };
  }

  /**
   * Check eligibility given a specific loan
   */
  async eligibilityByLoan(loanId: string) {
    const loan = await this.findOne(loanId);
    return this.getReloanEligibility(loan);
  }

  private getReloanEligibility(loan: Loan) {
    let minWeeks: number;
    switch (loan.termWeeks) {
      case 4:
        minWeeks = 2;
        break;
      case 8:
        minWeeks = 5;
        break;
      case 12:
        minWeeks = 8;
        break;
      default:
        minWeeks = Math.ceil(loan.termWeeks * 0.625); // Fallback formula (5/8 of term)
    }

    const outstandingCharges = this.loanChargePolicyService.isEligible(loan)
      ? this.loanChargesService.getOutstanding(loan).totalOutstanding
      : 0;
    const eligible =
      loan.weeksPaid >= minWeeks &&
      loan.status === 'active' &&
      outstandingCharges === 0;
    return {
      eligible,
      minWeeksRequired: minWeeks,
      weeksPaid: loan.weeksPaid,
      termWeeks: loan.termWeeks,
      outstandingCharges,
    };
  }

  /**
   * Reloan flow with flat service charge and notarial fee plus Net Off / Pay Off modes.
   * - payoff: client pays old balance in cash; new principal - serviceCharge - notarialFee is released
   * - netoff: old balance is deducted from new loan principal; released = new principal - old balance - serviceCharge - notarialFee
   */
  async reloan(loanId: string, dto: ReloanDto, actorId?: string) {
    return this.loanRepository.manager.transaction((manager) =>
      this.reloanWithinTransaction(
        loanId,
        dto,
        actorId,
        getFinancialBusinessDate(),
        manager,
      ),
    );
  }

  private async reloanWithinTransaction(
    loanId: string,
    dto: ReloanDto,
    actorId: string | undefined,
    businessDate: string,
    manager: EntityManager,
  ) {
    const {
      newPrincipalAmount,
      newTermWeeks,
      mode,
      serviceCharge,
      notarialFee,
      savings,
      monthlyInterestRate,
    } = dto;
    if (newPrincipalAmount <= 0)
      throw new BadRequestException('newPrincipalAmount must be > 0');
    if (![4, 8, 12, 24].includes(newTermWeeks))
      throw new BadRequestException('newTermWeeks must be 4, 8, 12, or 24');
    if (!['payoff', 'netoff'].includes(mode))
      throw new BadRequestException('mode must be payoff or netoff');

    // Validate the term/rate before changing the existing loan state.
    this.calculateLoanDetails(
      Number(newPrincipalAmount),
      newTermWeeks,
      monthlyInterestRate,
    );

    const loanRepository = manager.getRepository(Loan);
    const collectionRepository = manager.getRepository(Collection);
    await loanRepository
      .createQueryBuilder('loan')
      .setLock('pessimistic_write')
      .where('loan.id = :loanId', { loanId })
      .getOne();
    const loan = await loanRepository.findOne({
      where: { id: loanId },
      relations: ['borrower'],
    });
    if (!loan) {
      throw new NotFoundException(`Loan #${loanId} not found`);
    }
    if (loan.status !== 'active')
      throw new BadRequestException('Only active loans can be reloaned');

    if (
      this.loanChargePolicyService.isEligible(loan) &&
      this.loanChargesService.getOutstanding(loan).totalOutstanding > 0
    ) {
      throw new BadRequestException(
        'Outstanding penalties and past-due interest must be paid or waived before reloan',
      );
    }

    const { eligible, minWeeksRequired } = this.getReloanEligibility(loan);
    if (!eligible)
      throw new BadRequestException(
        `Not eligible for reloan. Requires >= ${minWeeksRequired} weeks paid.`,
      );

    if (
      serviceCharge === undefined ||
      serviceCharge === null ||
      isNaN(Number(serviceCharge)) ||
      Number(serviceCharge) < 0
    ) {
      throw new BadRequestException(
        'serviceCharge is required and must be >= 0',
      );
    }
    const fee = Number(serviceCharge);
    const legalFee =
      notarialFee !== undefined && notarialFee !== null
        ? Number(notarialFee)
        : 0;
    if (isNaN(legalFee) || legalFee < 0) {
      throw new BadRequestException('notarialFee is required and must be >= 0');
    }
    const savingsAmount =
      savings !== undefined && savings !== null ? Number(savings) : 0;
    if (isNaN(savingsAmount) || savingsAmount < 0) {
      throw new BadRequestException('savings must be >= 0 when provided');
    }

    // Combine any accumulated savings on the old loan for carry-over.
    // Compute old remaining balance
    const oldRemaining = Number(loan.balance);

    // Close old loan - mark as completed based on mode
    loan.status = mode === 'payoff' ? 'payoff' : 'netoff';
    loan.balance = 0;
    loan.advancePaymentBuffer = 0;
    await loanRepository.save(loan);

    // Create the new loan
    const borrowerId = loan.borrower.id;
    const tempCreate: CreateLoanDto = {
      borrowerId,
      principalAmount: Number(newPrincipalAmount),
      termWeeks: newTermWeeks,
      savings: savingsAmount,
      serviceCharge: fee,
      notarialFee: legalFee,
      monthlyInterestRate,
    };
    const newLoan = await this.createLoanWithinTransaction(
      tempCreate,
      {
        origin: 'reloan',
        actorId,
        businessDate,
      },
      manager,
    );

    // Reset any existing collections' paymentReceived to 0 for this member (already done in create, but being explicit)
    await collectionRepository.update(
      { memberId: borrowerId },
      { paymentReceived: 0 },
    );

    // Compute net cash released per mode
    let netCashReleased = 0;
    if (mode === 'payoff') {
      // Client pays old balance in cash, gets full new loan minus service charge and savings
      netCashReleased =
        Number(newPrincipalAmount) - fee - legalFee - savingsAmount;
    } else {
      // Net off: old balance is deducted from new loan; also deduct service charge, notarial fee, and savings
      netCashReleased =
        Number(newPrincipalAmount) -
        oldRemaining -
        fee -
        legalFee -
        savingsAmount;
      if (netCashReleased < 0) netCashReleased = 0; // Never negative release
    }

    // Persist net cash released on the newly created loan
    await loanRepository.update(newLoan.id, {
      netCashReleased: Number(netCashReleased) || 0,
    });
    // reflect in object returned
    newLoan.netCashReleased = Number(netCashReleased) || 0;

    return {
      oldLoanId: loanId,
      newLoanId: newLoan.id,
      mode,
      serviceCharge: fee,
      notarialFee: legalFee,
      savings: savingsAmount,
      oldRemaining,
      newPrincipalAmount,
      netCashReleased,
      newLoan,
      message:
        mode === 'payoff'
          ? `Pay Off: Client pays ₱${oldRemaining.toLocaleString()} cash, receives ₱${netCashReleased.toLocaleString()}`
          : `Net Off: ₱${oldRemaining.toLocaleString()} deducted from new loan, client receives ₱${netCashReleased.toLocaleString()}`,
    };
  }

  async update(id: string, updateLoanDto: UpdateLoanDto): Promise<Loan> {
    void updateLoanDto;
    const loan = await this.findOne(id);

    // Currently no updatable fields
    return this.loanRepository.save(loan);
  }

  async updateTermWeeks(
    id: string,
    newTermWeeks: number,
    monthlyInterestRate?: number,
  ): Promise<Loan> {
    const loan = await this.findOne(id);

    if (loan.status !== 'active') {
      throw new BadRequestException(
        'Only active loans can have their term updated',
      );
    }

    if (Number(loan.weeksPaid || 0) > 0 || Number(loan.amountPaid || 0) > 0) {
      throw new BadRequestException(
        'Cannot change term weeks after repayments have been recorded',
      );
    }

    if (
      this.loanChargePolicyService.isEligible(loan) &&
      (Number(loan.penaltyAccrued || 0) > 0 ||
        Number(loan.pastDueInterestAccrued || 0) > 0)
    ) {
      throw new BadRequestException(
        'Cannot change term weeks after overdue charges have been recorded',
      );
    }

    const { interestRate, totalAmount, weeklyPaymentAmount } =
      this.calculateLoanDetails(
        Number(loan.principalAmount),
        newTermWeeks,
        monthlyInterestRate,
      );

    loan.termWeeks = newTermWeeks;
    loan.interestRate = interestRate;
    loan.totalAmount = totalAmount;
    loan.weeklyPaymentAmount = weeklyPaymentAmount;
    loan.balance = totalAmount;
    loan.amountPaid = 0;
    loan.weeksPaid = 0;
    loan.advancePaymentBuffer = 0;

    await this.loanRepository.save(loan);

    const borrower = await this.memberRepository.findOne({
      where: { id: loan.borrower.id },
      relations: ['center'],
    });

    if (!borrower) {
      throw new NotFoundException(
        `Borrower #${loan.borrower.id} not found while rebuilding schedule`,
      );
    }

    await this.rebuildRepaymentSchedule(loan, borrower);

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const loan = await this.loanRepository.findOne({ where: { id } });
    if (!loan) {
      throw new NotFoundException(`Loan #${id} not found`);
    }

    throw new ConflictException(
      'Loan cannot be deleted because persisted loans are financial history',
    );
  }

  // Check if member is eligible for reloan
  async isEligibleForReloan(memberId: string): Promise<{
    eligible: boolean;
    reason?: string;
    activeLoan?: Loan;
  }> {
    const activeLoan = await this.loanRepository.findOne({
      where: { borrower: { id: memberId }, status: 'active' },
    });

    if (!activeLoan) {
      return { eligible: true };
    }

    const minWeeks = activeLoan.termWeeks === 8 ? 5 : 8;

    if (activeLoan.weeksPaid < minWeeks) {
      return {
        eligible: false,
        reason: `Need at least ${minWeeks} weeks paid (currently ${activeLoan.weeksPaid})`,
        activeLoan,
      };
    }

    return {
      eligible: false,
      reason: 'Member has active loan that needs to be paid off or net off',
      activeLoan,
    };
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

  private nextCollectionDate(
    fromDate: Date,
    collectionDay: string,
    skipIfSameWeek = false,
  ): Date {
    const base = this.normalizeDate(fromDate);
    const targetIndex = this.getWeekdayIndex(collectionDay);
    if (targetIndex < 0) return base;
    const currentIndex = base.getUTCDay();
    let delta = (targetIndex - currentIndex + 7) % 7;
    if (delta === 0 && skipIfSameWeek) {
      delta = 7;
    }
    return this.addDays(base, delta);
  }

  private computeFirstDueDate(
    loan: Loan,
    member: Member,
    center: Member['center'] | null,
  ): Date {
    const baseDate = this.normalizeDate(
      loan.loanCreatedDate ?? loan.createdAt ?? new Date(),
    );
    const collectionDay =
      center?.collectionDay ?? member.center?.collectionDay ?? null;
    const targetIndex = this.getWeekdayIndex(collectionDay);
    if (targetIndex < 0) {
      return baseDate;
    }
    const currentIndex = baseDate.getUTCDay();
    let delta = (targetIndex - currentIndex + 7) % 7;
    // If loan is created on the collection day, first due is the following week
    if (delta === 0) {
      delta = 7;
    }
    return this.addDays(baseDate, delta);
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

  private async rebuildRepaymentSchedule(
    loan: Loan,
    member: Member,
    manager?: EntityManager,
  ): Promise<void> {
    const scheduleRepository =
      manager?.getRepository(LoanRepaymentSchedule) ?? this.scheduleRepository;
    await scheduleRepository.delete({ loanId: loan.id });

    const termWeeks = Number(loan.termWeeks || 0);
    const weeklyDue = Number(loan.weeklyPaymentAmount || 0);
    if (termWeeks <= 0 || weeklyDue <= 0) {
      return;
    }

    const center = member.center ?? null;
    const firstDueDate = this.computeFirstDueDate(loan, member, center);
    const schedules: LoanRepaymentSchedule[] = [];
    const breakdown = buildLoanRepaymentBreakdown(loan);

    for (let i = 0; i < termWeeks; i += 1) {
      const dueDate = this.addDays(firstDueDate, i * 7);
      const scheduleBreakdown = breakdown[i];
      schedules.push(
        scheduleRepository.create({
          loanId: loan.id,
          memberId: member.id,
          centerId: center?.id ?? null,
          weekNumber: i + 1,
          dueDate: this.formatDate(dueDate),
          amountDue: scheduleBreakdown?.amountDue ?? weeklyDue,
          principalDue: scheduleBreakdown?.principalDue ?? 0,
          interestDue: scheduleBreakdown?.interestDue ?? Math.max(0, weeklyDue),
          amountPaid: 0,
          status: LoanRepaymentStatus.UNPAID,
          advanceApplied: 0,
        }),
      );
    }

    await scheduleRepository.save(schedules);
  }
}
