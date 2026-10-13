import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository, DataSource } from 'typeorm';
import { Member } from './entities/member.entity';
import { Center } from '../centers/entities/center.entity';
import { Loan } from '../loans/loan.entity';
import { Repayment } from '../repayments/repayment.entity';
import { Savings } from '../savings/savings.entity';
import { Collection } from '../collections/entities/collection.entity';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { FindMembersQueryDto } from './dto/find-members-query.dto';
import { LoanRepaymentSchedule } from '../repayments/entities/loan-repayment-schedule.entity';
import {
  RepaymentOperationType,
  RepaymentStatus,
} from '../repayments/repayment.entity';
import { addDaysToDateOnly, parseDateOnly } from '../common/date-only';

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
      { paid: boolean; hasAllocation: boolean }
    >();
    const activeLoans = loans.filter((loan) => loan.status === 'active');
    if (date && activeLoans.length > 0) {
      const selectedDate = parseDateOnly(date);
      const weekStart = addDaysToDateOnly(
        selectedDate,
        -((selectedDate.weekdayIndex + 1) % 7),
      );
      const weekEnd = addDaysToDateOnly(parseDateOnly(weekStart), 6);
      const schedules = await this.dataSource
        .getRepository(LoanRepaymentSchedule)
        .find({
          where: {
            loanId: In(activeLoans.map((loan) => loan.id)),
            dueDate: Between(weekStart, weekEnd),
          },
          relations: ['allocations', 'allocations.repayment'],
        });
      const memberIdByLoanId = new Map(
        activeLoans.map((loan) => [loan.id, loan.borrower.id]),
      );
      const fundingByMember = new Map<
        string,
        { dueCents: number; appliedCents: number }
      >();

      for (const schedule of schedules) {
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
            }
          : {}),
      };
    });
  }
}
