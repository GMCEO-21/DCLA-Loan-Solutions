import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { AdvancePaymentStatus, Collection } from './entities/collection.entity';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { Center } from '../centers/entities/center.entity';
import { Member } from '../members/entities/member.entity';
import { CollectionsRepository } from './collections.repository';
import { FindCollectionsQueryDto } from './dto/find-collections-query.dto';
import {
  Repayment,
  RepaymentOperationType,
  RepaymentStatus,
} from '../repayments/repayment.entity';
import { SavingsEventType } from '../savings/savings.entity';
import { LoanChargeLedgerEventType } from '../loans/entities/loan-charge-ledger.entity';
import { addDaysToDateOnly, parseDateOnly } from '../common/date-only';
import { getFinancialBusinessDate } from '../common/financial-business-date';

@Injectable()
export class CollectionsService {
  private readonly logger = new Logger(CollectionsService.name);

  constructor(
    @InjectRepository(Collection)
    private readonly collectionRepo: Repository<Collection>,
    @InjectRepository(Center)
    private readonly centerRepo: Repository<Center>,
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
    @InjectRepository(Repayment)
    private readonly repaymentRepo: Repository<Repayment>,
    private readonly collectionsRepository: CollectionsRepository,
  ) {}

  private weekdayToIndex(weekday: string): number | null {
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const index = days.findIndex(
      (day) => day.toLowerCase() === weekday?.toLowerCase(),
    );
    return index === -1 ? null : index;
  }

  private getNextCollectionDate(collectionDay: string) {
    const today = this.resolveTargetDate();
    const targetIndex = this.weekdayToIndex(collectionDay);
    if (targetIndex === null) {
      return today.value;
    }

    const diff = (targetIndex + 7 - today.weekdayIndex) % 7;
    return addDaysToDateOnly(today, diff);
  }

  private resolveTargetDate(dateInput?: string) {
    try {
      return parseDateOnly(dateInput ?? getFinancialBusinessDate());
    } catch {
      throw new BadRequestException(
        'Invalid collection date. Expected a valid YYYY-MM-DD date.',
      );
    }
  }

  private async calculateTotalReceivedForDate(centerId: string, date: string) {
    const totals = await this.getTotalReceivedByCenterForDate(date);
    return totals.get(centerId) ?? 0;
  }

  private async getMemberCountsByCenter(centerIds: string[]) {
    if (centerIds.length === 0) return new Map<string, number>();

    const rows = await this.memberRepo
      .createQueryBuilder('member')
      .select('member.centerId', 'centerId')
      .addSelect('COUNT(*)', 'count')
      .where('member.centerId IN (:...centerIds)', { centerIds })
      .groupBy('member.centerId')
      .getRawMany<{ centerId: string; count: string }>();

    return new Map(rows.map((row) => [row.centerId, Number(row.count)]));
  }

  private async getTotalReceivedByCenterForDate(date: string) {
    // Cash plus the actual savings debit is the payment value. Contractual and
    // charge allocations partition that value and must not be added again.
    const rows = await this.repaymentRepo.query<
      Array<{
        centerId: string;
        status: RepaymentStatus;
        cashAmount: string;
        savingsAmount: string;
        isReversed: boolean;
      }>
    >(
      `SELECT
         payment."centerId" AS "centerId",
         payment.status AS status,
         payment.amount AS "cashAmount",
         COALESCE(
           (
             SELECT ABS(SUM(savings.amount))
             FROM savings
             WHERE savings."referenceId" = payment.id
               AND savings."eventType" = $3
           ),
           (
             COALESCE((
               SELECT SUM(allocation."savingsPortion")
               FROM loan_repayment_allocation allocation
               WHERE allocation."repaymentId" = payment.id
             ), 0)
             + COALESCE((
               SELECT SUM(charge."savingsPortion")
               FROM loan_charge_ledger charge
               WHERE charge."sourceRepaymentId" = payment.id
                 AND charge."eventType" = $6
             ), 0)
           ),
           0
         ) AS "savingsAmount",
         EXISTS (
           SELECT 1
           FROM repayment reversal
           WHERE reversal."relatedRepaymentId" = payment.id
             AND reversal."operationType" = $4
             AND reversal.status = $5
         ) AS "isReversed"
       FROM repayment payment
       WHERE payment."operationType" = $1
         AND COALESCE(payment."paymentDate", payment."collectionDate") = $2::date`,
      [
        RepaymentOperationType.PAYMENT,
        date,
        SavingsEventType.REPAYMENT_DEBIT,
        RepaymentOperationType.REVERSAL,
        RepaymentStatus.APPROVED,
        LoanChargeLedgerEventType.PAYMENT,
      ],
    );

    const totals = new Map<string, number>();
    for (const row of rows) {
      if (row.status !== RepaymentStatus.APPROVED || row.isReversed) continue;

      const paymentValue =
        Number(row.cashAmount || 0) + Number(row.savingsAmount || 0);
      totals.set(row.centerId, (totals.get(row.centerId) ?? 0) + paymentValue);
    }
    return totals;
  }

  async create(createCollectionDto: CreateCollectionDto) {
    const center = await this.centerRepo.findOneBy({
      id: createCollectionDto.centerId,
    });
    if (!center) throw new NotFoundException('Center not found');

    const member = await this.memberRepo.findOneBy({
      id: createCollectionDto.memberId,
    });
    if (!member) throw new NotFoundException('Member not found');

    const collection = this.collectionRepo.create({
      ...createCollectionDto,
      center,
      member,
    });
    return this.collectionRepo.save(collection);
  }

  async findAll(query: FindCollectionsQueryDto) {
    try {
      // Log the query for debugging
      this.logger.debug(
        `Searching collections with query: ${JSON.stringify(query)}`,
      );

      // Validate search parameter
      if (query.search && query.search.trim().length < 2) {
        throw new BadRequestException(
          'Search term must be at least 2 characters long',
        );
      }

      return await this.collectionsRepository.findAllWithQuery(query);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : null;
      this.logger.error(
        'Failed to fetch collections',
        error?.stack ?? String(err),
      );

      // Re-throw BadRequestException with specific message
      if (err instanceof BadRequestException) {
        throw err;
      }

      // Generic error for other issues
      throw new BadRequestException(
        'Invalid query parameters: ' + (error?.message ?? 'Unknown error'),
      );
    }
  }

  findOne(id: string) {
    return this.collectionRepo.findOne({
      where: { id },
      relations: ['center', 'member'],
    });
  }

  async update(id: string, updateDto: UpdateCollectionDto) {
    await this.collectionRepo.update(id, updateDto);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.collectionRepo.delete(id);
    return { deleted: true };
  }

  /**
   * Get collections for a specific date
   */
  async getCollectionsByDate(date: string) {
    return this.collectionRepo.find({
      where: { collectionDate: date },
      relations: ['center', 'member'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get collections for a specific center on a specific date
   */
  async getCenterCollectionsByDate(centerId: string, date: string) {
    return this.collectionRepo.find({
      where: {
        centerId,
        collectionDate: date,
      },
      relations: ['center', 'member'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * DAILY COLLECTION LOGIC - Enhanced version
   */
  async getTodayCollections(dateParam?: string) {
    const targetDate = this.resolveTargetDate(dateParam);
    const weekday = targetDate.weekday;
    const dateString = targetDate.value;

    this.logger.log(
      `Getting collections for ${weekday} (${dateString}) [input=${dateParam ?? 'today'}]`,
    );

    const centers = await this.centerRepo.find({
      where: { collectionDay: weekday },
    });

    const centerIds = centers.map((center) => center.id);
    if (centerIds.length === 0) return [];

    const [collections, memberCounts, receivedTotals] = await Promise.all([
      this.collectionRepo.find({
        where: { centerId: In(centerIds), collectionDate: dateString },
        relations: ['member'],
      }),
      this.getMemberCountsByCenter(centerIds),
      this.getTotalReceivedByCenterForDate(dateString),
    ]);
    const collectionsByCenter = new Map<string, Collection[]>();
    for (const collection of collections) {
      const entries = collectionsByCenter.get(collection.centerId) ?? [];
      entries.push(collection);
      collectionsByCenter.set(collection.centerId, entries);
    }

    return centers.map((center) => {
      const existingCollections = collectionsByCenter.get(center.id) ?? [];
      const totalMembers = memberCounts.get(center.id) ?? 0;
      return {
        centerId: center.id,
        centerName: center.name,
        collectionDay: center.collectionDay,
        collectionDate: dateString,
        totalMembers,
        collections: existingCollections,
        pendingCollections: totalMembers - existingCollections.length,
        totalAmount: existingCollections.reduce(
          (sum, c) => sum + Number(c.amount),
          0,
        ),
        totalReceived: receivedTotals.get(center.id) ?? 0,
      };
    });
  }

  async getAllCollectionsGrouped(dateParam?: string) {
    const centers = await this.centerRepo.find();
    const centerMap = new Map(centers.map((center) => [center.id, center]));

    const targetDate = dateParam
      ? this.resolveTargetDate(dateParam).value
      : null;

    const [memberCounts, collections, receivedTotals] = await Promise.all([
      this.getMemberCountsByCenter(centers.map((center) => center.id)),
      this.collectionRepo.find({
        where: targetDate ? { collectionDate: targetDate } : {},
        relations: ['member'],
        order: { collectionDate: 'ASC', createdAt: 'ASC' },
      }),
      targetDate
        ? this.getTotalReceivedByCenterForDate(targetDate)
        : Promise.resolve(new Map<string, number>()),
    ]);

    const grouped = new Map<
      string,
      {
        centerId: string;
        collectionDate: string;
        collections: Collection[];
      }
    >();

    for (const collection of collections) {
      const key = `${collection.centerId}__${collection.collectionDate}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          centerId: collection.centerId,
          collectionDate: collection.collectionDate,
          collections: [],
        });
      }
      grouped.get(key)!.collections.push(collection);
    }

    const aggregated = await Promise.all(
      Array.from(grouped.values()).map(async (entry) => {
        const center = centerMap.get(entry.centerId);
        if (!center) {
          this.logger.warn(
            `Center ${entry.centerId} referenced in collections but not found`,
          );
          return null;
        }

        const totalMembers = memberCounts.get(entry.centerId) ?? 0;
        const totalAmount = entry.collections.reduce(
          (sum, c) => sum + Number(c.amount || 0),
          0,
        );
        const totalReceived = targetDate
          ? (receivedTotals.get(entry.centerId) ?? 0)
          : await this.calculateTotalReceivedForDate(
              entry.centerId,
              entry.collectionDate,
            );

        return {
          centerId: entry.centerId,
          centerName: center.name,
          collectionDay: center.collectionDay,
          collectionDate: entry.collectionDate,
          totalMembers,
          pendingCollections: Math.max(
            totalMembers - entry.collections.length,
            0,
          ),
          totalAmount,
          totalReceived,
          collections: entry.collections,
        };
      }),
    );

    const existingGroups = aggregated.filter(
      (group): group is NonNullable<typeof group> => Boolean(group),
    );

    const placeholders = centers
      .filter(
        (center) =>
          !existingGroups.some((group) => group.centerId === center.id),
      )
      .map((center) => {
        const totalMembers = memberCounts.get(center.id) ?? 0;
        return {
          centerId: center.id,
          centerName: center.name,
          collectionDay: center.collectionDay,
          collectionDate:
            targetDate ?? this.getNextCollectionDate(center.collectionDay),
          totalMembers,
          pendingCollections: totalMembers,
          totalAmount: 0,
          totalReceived: 0,
          collections: [],
        };
      });

    const allGroups = [...existingGroups, ...placeholders];

    const todayMs = this.resolveTargetDate().utcTimestamp;

    return allGroups.sort((a, b) => {
      const aTime = parseDateOnly(a.collectionDate).utcTimestamp;
      const bTime = parseDateOnly(b.collectionDate).utcTimestamp;

      const aDiff = Math.abs(aTime - todayMs);
      const bDiff = Math.abs(bTime - todayMs);

      if (aDiff === bDiff) {
        if (aTime === bTime) {
          return a.centerName.localeCompare(b.centerName);
        }
        return aTime - bTime;
      }

      return aDiff - bDiff;
    });
  }

  /**
   * Auto-generate collections for a specific date and center
   */
  async autoGenerateCollections(centerId: string, date: string) {
    const center = await this.centerRepo.findOne({
      where: { id: centerId },
    });

    if (!center) {
      throw new NotFoundException('Center not found');
    }

    const existingCollections = await this.collectionRepo.find({
      where: { centerId, collectionDate: date },
    });

    if (existingCollections.length > 0) {
      throw new BadRequestException(
        `Collections already exist for ${date} in center ${center.name}`,
      );
    }

    const centerMembers = await this.memberRepo.find({
      where: { center: { id: centerId } },
    });

    const collections: Collection[] = [];
    for (const member of centerMembers) {
      const defaultAmount = 100;

      const collection = this.collectionRepo.create({
        centerId,
        memberId: member.id,
        collectionDate: date,
        amount: defaultAmount,
        netRelease: 0,
        paymentReceived: 0,
        isAutoGenerated: true,
        notes: 'Auto-generated collection',
        numberOfPayments: 0,
        advancePaymentAmount: 0,
        advancePaymentStatus: AdvancePaymentStatus.NONE,
      });

      collections.push(collection);
    }

    const savedCollections = await this.collectionRepo.save(collections);

    this.logger.log(
      `Auto-generated ${savedCollections.length} collections for center ${center.name} on ${date}`,
    );

    return savedCollections;
  }

  /**
   * Get collection statistics for a date range
   */
  async getCollectionStats(startDate: string, endDate: string) {
    const collections = await this.collectionRepo.find({
      where: {
        collectionDate: Between(startDate, endDate),
      },
      relations: ['center', 'member'],
    });

    const stats = {
      totalCollections: collections.length,
      totalAmount: collections.reduce((sum, c) => sum + Number(c.amount), 0),
      totalReceived: collections.reduce(
        (sum, c) => sum + Number(c.paymentReceived),
        0,
      ),
      pendingAmount: collections
        .filter((c) => c.paymentReceived < c.amount)
        .reduce(
          (sum, c) => sum + (Number(c.amount) - Number(c.paymentReceived)),
          0,
        ),
      paidCollections: collections.filter((c) => c.paymentReceived >= c.amount)
        .length,
      pendingCollections: collections.filter(
        (c) => c.paymentReceived < c.amount,
      ).length,
    };

    return stats;
  }

  /**
   * Update collection payment
   */
  async updatePayment(
    id: string,
    paymentData: { paymentAmount: number; notes?: string },
  ) {
    const collection = await this.findOne(id);
    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    // Get the member's active loan to get the cumulative amount paid
    const member = await this.memberRepo.findOne({
      where: { id: collection.memberId },
      relations: ['loans'],
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const activeLoan = member.loans?.find((loan) => loan.status === 'active');
    if (!activeLoan) {
      throw new NotFoundException('No active loan found for member');
    }

    // Set paymentReceived to the cumulative amount paid from the loan
    const cumulativeAmountPaid = Number(activeLoan.amountPaid) || 0;

    const updateData: UpdateCollectionDto = {
      paymentReceived: cumulativeAmountPaid,
      notes: paymentData.notes || collection.notes,
    };

    return this.update(id, updateData);
  }
}
