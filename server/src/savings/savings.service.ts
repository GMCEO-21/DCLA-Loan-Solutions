import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Savings, SavingsEventType } from './savings.entity';
import { Member } from '../members/entities/member.entity';
import { Loan } from '../loans/loan.entity';
import { DepositSavingsDto } from './dto/deposit-savings.dto';
import { WithdrawSavingsDto } from './dto/withdraw-savings.dto';
import { getFinancialBusinessDate } from '../common/financial-business-date';
import { LoansService } from '../loans/loans.service';

@Injectable()
export class SavingsService {
  constructor(
    @InjectRepository(Savings)
    private readonly savingsRepository: Repository<Savings>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    private readonly loansService: LoansService,
  ) {}

  async deposit(dto: DepositSavingsDto, actorId?: string) {
    const { memberId, loanId, amount, remarks } = dto;
    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      throw new BadRequestException('amount must be greater than 0');
    }

    return this.loanRepository.manager.transaction(async (manager) => {
      const businessDate = getFinancialBusinessDate();
      const member = await this.findMember(manager, memberId);
      const loan = await this.findLockedActiveLoan(
        manager,
        memberId,
        loanId,
        'deposit',
      );
      const savingsRepository = manager.getRepository(Savings);
      const loanRepository = manager.getRepository(Loan);
      const currentSavings = Number(loan.savings || 0);
      const updatedSavings = currentSavings + numericAmount;
      const savingsEntry = savingsRepository.create({
        borrower: member,
        loan,
        amount: numericAmount,
        remarks,
        eventType: SavingsEventType.MANUAL_DEPOSIT,
        balanceBefore: currentSavings,
        balanceAfter: updatedSavings,
        businessDate,
        referenceType: null,
        referenceId: null,
        idempotencyKey: null,
        performedById: actorId ?? null,
        reversalOfId: null,
      });
      const savedEntry = await savingsRepository.save(savingsEntry);

      loan.savings = updatedSavings;
      await loanRepository.save(loan);

      return {
        entry: this.mapSavings(savedEntry, memberId),
        loan: {
          id: loan.id,
          savings: updatedSavings,
        },
      };
    });
  }

  async withdraw(dto: WithdrawSavingsDto, actorId?: string) {
    const { memberId, loanId, amount, remarks } = dto;
    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      throw new BadRequestException('amount must be greater than 0');
    }

    return this.loanRepository.manager.transaction(async (manager) => {
      const businessDate = getFinancialBusinessDate();
      const member = await this.findMember(manager, memberId);
      const loan = await this.findLockedActiveLoan(
        manager,
        memberId,
        loanId,
        'withdraw',
      );
      const currentSavings = Number(loan.savings || 0);
      if (numericAmount > currentSavings) {
        throw new BadRequestException(
          'Cannot withdraw more than available savings',
        );
      }

      const savingsRepository = manager.getRepository(Savings);
      const loanRepository = manager.getRepository(Loan);
      const updatedSavings = currentSavings - numericAmount;
      const savingsEntry = savingsRepository.create({
        borrower: member,
        loan,
        amount: -numericAmount,
        remarks,
        eventType: SavingsEventType.MANUAL_WITHDRAWAL,
        balanceBefore: currentSavings,
        balanceAfter: updatedSavings,
        businessDate,
        referenceType: null,
        referenceId: null,
        idempotencyKey: null,
        performedById: actorId ?? null,
        reversalOfId: null,
      });
      const savedEntry = await savingsRepository.save(savingsEntry);

      loan.savings = updatedSavings;
      await loanRepository.save(loan);

      return {
        entry: this.mapSavings(savedEntry, memberId),
        loan: {
          id: loan.id,
          savings: updatedSavings,
        },
      };
    });
  }

  private async findMember(
    manager: EntityManager,
    memberId: string,
  ): Promise<Member> {
    const member = await manager.getRepository(Member).findOne({
      where: { id: memberId },
    });
    if (!member) {
      throw new NotFoundException(`Member #${memberId} not found`);
    }
    return member;
  }

  private async findLockedActiveLoan(
    manager: EntityManager,
    memberId: string,
    loanId: string | undefined,
    operation: 'deposit' | 'withdraw',
  ): Promise<Loan> {
    const query = manager
      .getRepository(Loan)
      .createQueryBuilder('loan')
      .setLock('pessimistic_write')
      .where('loan."borrowerId" = :memberId', { memberId });

    if (loanId) {
      query.andWhere('loan.id = :loanId', { loanId });
    } else {
      query.andWhere('loan.status = :status', { status: 'active' });
    }

    const loan = await query.getOne();
    if (!loan) {
      if (loanId) {
        const existingLoan = await manager.getRepository(Loan).findOne({
          where: { id: loanId },
        });
        if (!existingLoan) {
          throw new NotFoundException(`Loan #${loanId} not found`);
        }
        throw new BadRequestException('Loan does not belong to the member');
      }
      throw new BadRequestException('Member has no active loan');
    }
    if (loan.status !== 'active') {
      throw new BadRequestException(
        `Cannot ${operation} ${operation === 'deposit' ? 'to' : 'from'} an inactive loan`,
      );
    }
    return loan;
  }

  async findByMember(memberId: string) {
    const member = await this.memberRepository.findOne({
      where: { id: memberId },
    });
    if (!member) {
      throw new NotFoundException(`Member #${memberId} not found`);
    }

    const [entries, authoritativeLoan] = await Promise.all([
      this.savingsRepository.find({
        where: { borrower: { id: memberId } },
        relations: ['loan', 'borrower'],
        order: { createdAt: 'DESC' },
      }),
      this.loansService.findAuthoritativeSavingsLoanForMember(memberId),
    ]);

    const totalDeposits = entries.reduce(
      (sum, entry) => sum + this.toNumber(entry.amount),
      0,
    );

    const hasActiveLoan = authoritativeLoan?.status === 'active';
    const currentSavings = authoritativeLoan
      ? this.toNumber(authoritativeLoan.savings)
      : 0;

    return {
      entries: entries.map((entry) => this.mapSavings(entry, memberId)),
      totalDeposits,
      currentSavings,
      activeLoanSavings: hasActiveLoan ? currentSavings : 0,
      activeLoanId: hasActiveLoan ? authoritativeLoan.id : null,
      hasActiveLoan,
    };
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }
    return Number(value) || 0;
  }

  private mapSavings(entry: Savings, fallbackMemberId?: string) {
    return {
      id: entry.id,
      borrowerId: entry.borrower?.id ?? fallbackMemberId ?? null,
      loanId: entry.loan?.id ?? null,
      amount: this.toNumber(entry.amount),
      remarks: entry.remarks || null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}
