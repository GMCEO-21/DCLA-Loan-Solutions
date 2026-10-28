import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID, timingSafeEqual } from 'crypto';
import { DataSource, In, Not } from 'typeorm';
import { Loan } from '../loans/loan.entity';
import {
  Repayment,
  RepaymentOperationType,
  RepaymentStatus,
} from '../repayments/repayment.entity';
import {
  SmsNotification,
  SmsNotificationEventType,
  SmsNotificationStatus,
} from './entities/sms-notification.entity';
import { SmsProviderError } from './providers/sms-provider';
import { SmsCreditsResult, UniSmsProvider } from './providers/unisms.provider';
import { getManilaDayBounds, toUtcTimestampParameter } from './recent-sms-time';
import { SmsRecipientNormalizer } from './sms-recipient-normalizer';
import { SmsTemplateService } from './sms-template.service';

interface SmsCandidate {
  eventType: SmsNotificationEventType;
  resourceId: string;
  memberId: string;
  loanId: string;
  repaymentId: string | null;
  memberName: string;
  amount: number;
  contactNumber: string | null;
  recipient: string | null;
  recipientMasked: string | null;
  eligible: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  message: string;
  idempotencyKey: string;
}

export interface SmsEligibilityItem {
  resourceId: string;
  memberName: string;
  amount: number;
  recipientMasked: string | null;
  eligible: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  notificationId: string | null;
  notificationStatus: SmsNotificationStatus | null;
}

export interface SmsRequestResult extends SmsEligibilityItem {
  eventType: SmsNotificationEventType;
  created: boolean;
  status: SmsNotificationStatus;
}

interface LoanSmsRow {
  loanId: string;
  principalAmount: string;
  memberId: string;
  firstName: string;
  lastName: string;
  contactNumber: string | null;
}

interface RepaymentSmsRow {
  repaymentId: string;
  status: RepaymentStatus;
  operationType: RepaymentOperationType;
  amount: string;
  paymentDate: string | null;
  collectionDate: string | null;
  memberId: string;
  firstName: string;
  lastName: string;
  contactNumber: string | null;
  loanId: string;
  loanBorrowerId: string;
}

interface RecentSmsRow {
  notificationId: string;
  eventType: SmsNotificationEventType;
  status: SmsNotificationStatus;
  createdAt: Date;
  updatedAt: Date;
  sentAt: Date | null;
  firstName: string | null;
  lastName: string | null;
}

interface RecentSmsSummaryRow {
  sentToday: string;
  pending: string;
  failedToday: string;
}

export interface RecentSmsResponse {
  items: Array<{
    notificationId: string;
    memberName: string;
    eventType: SmsNotificationEventType;
    status: SmsNotificationStatus;
    createdAt: Date;
    updatedAt: Date;
    sentAt: Date | null;
  }>;
  summary: {
    sentToday: number;
    pending: number;
    failedToday: number;
  };
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly recipientNormalizer: SmsRecipientNormalizer,
    private readonly templates: SmsTemplateService,
    private readonly uniSmsProvider: UniSmsProvider,
  ) {}

  async getLoanEligibility(loanId: string): Promise<SmsEligibilityItem> {
    const candidate = await this.loadLoanCandidate(loanId);
    const existing = await this.findExisting([candidate.idempotencyKey]);
    return this.toEligibility(
      candidate,
      existing.get(candidate.idempotencyKey),
    );
  }

  async getRepaymentEligibility(
    repaymentIds: string[],
  ): Promise<SmsEligibilityItem[]> {
    const candidates = await this.loadRepaymentCandidates(repaymentIds);
    const existing = await this.findExisting(
      candidates.map((item) => item.idempotencyKey),
    );
    return candidates.map((candidate) =>
      this.toEligibility(candidate, existing.get(candidate.idempotencyKey)),
    );
  }

  async requestLoanSms(
    loanId: string,
    requestedById?: string,
  ): Promise<SmsRequestResult> {
    this.requireSmsEnabled();
    const candidate = await this.loadLoanCandidate(loanId);
    return (await this.queueCandidates([candidate], requestedById))[0];
  }

  async requestRepaymentSms(
    repaymentId: string,
    requestedById?: string,
  ): Promise<SmsRequestResult> {
    this.requireSmsEnabled();
    const [candidate] = await this.loadRepaymentCandidates([repaymentId]);
    if (candidate.errorCode === 'NOT_APPROVED_PAYMENT') {
      throw new UnprocessableEntityException(candidate.errorMessage);
    }
    return (await this.queueCandidates([candidate], requestedById))[0];
  }

  async requestRepaymentBatch(
    repaymentIds: string[],
    requestedById?: string,
  ): Promise<{ items: SmsRequestResult[]; summary: Record<string, number> }> {
    this.requireSmsEnabled();
    const candidates = await this.loadRepaymentCandidates(repaymentIds);
    const items = await this.queueCandidates(candidates, requestedById);
    return {
      items,
      summary: {
        selected: items.length,
        queued: items.filter(
          (item) =>
            item.status === SmsNotificationStatus.PENDING && item.created,
        ).length,
        alreadySent: items.filter(
          (item) => item.status === SmsNotificationStatus.SENT && !item.created,
        ).length,
        invalidContact: items.filter(
          (item) => item.errorCode === 'INVALID_CONTACT_NUMBER',
        ).length,
        missingContact: items.filter(
          (item) => item.errorCode === 'MISSING_CONTACT_NUMBER',
        ).length,
        ineligible: items.filter(
          (item) => item.errorCode === 'NOT_APPROVED_PAYMENT',
        ).length,
      },
    };
  }

  async getStatus(id: string) {
    const notification = await this.dataSource
      .getRepository(SmsNotification)
      .findOne({ where: { id } });
    if (!notification)
      throw new NotFoundException('SMS notification not found');
    return this.toStatusResponse(notification);
  }

  async getSmsCredits(): Promise<SmsCreditsResult> {
    try {
      return await this.uniSmsProvider.getCredits();
    } catch (error) {
      if (
        error instanceof SmsProviderError &&
        error.code === 'UNISMS_INVALID_ACCOUNT_RESPONSE'
      ) {
        throw new BadGatewayException(
          'SMS credit information is temporarily unavailable.',
        );
      }

      throw new ServiceUnavailableException(
        'SMS credit information is temporarily unavailable.',
      );
    }
  }

  async getRecentSms(limit = 10): Promise<RecentSmsResponse> {
    const repository = this.dataSource.getRepository(SmsNotification);
    const { startUtc, endUtc } = getManilaDayBounds();
    const rangeParameters = {
      startUtc: toUtcTimestampParameter(startUtc),
      endUtc: toUtcTimestampParameter(endUtc),
    };

    const recentQuery = repository
      .createQueryBuilder('notification')
      .leftJoin('notification.member', 'member')
      .select('notification.id', 'notificationId')
      .addSelect('notification.eventType', 'eventType')
      .addSelect('notification.status', 'status')
      .addSelect('notification.createdAt', 'createdAt')
      .addSelect('notification.updatedAt', 'updatedAt')
      .addSelect('notification.sentAt', 'sentAt')
      .addSelect('member.firstName', 'firstName')
      .addSelect('member.lastName', 'lastName')
      .orderBy('notification.createdAt', 'DESC')
      .addOrderBy('notification.id', 'DESC')
      .limit(limit);

    const summaryQuery = repository
      .createQueryBuilder('notification')
      .select(
        `COUNT(*) FILTER (
          WHERE notification.status = :sentStatus
            AND notification.sentAt >= :startUtc
            AND notification.sentAt < :endUtc
        )`,
        'sentToday',
      )
      .addSelect(
        `COUNT(*) FILTER (
          WHERE notification.status IN (:...pendingStatuses)
        )`,
        'pending',
      )
      .addSelect(
        `COUNT(*) FILTER (
          WHERE notification.status = :failedStatus
            AND notification.updatedAt >= :startUtc
            AND notification.updatedAt < :endUtc
        )`,
        'failedToday',
      )
      .setParameters({
        sentStatus: SmsNotificationStatus.SENT,
        pendingStatuses: [
          SmsNotificationStatus.PENDING,
          SmsNotificationStatus.PROCESSING,
        ],
        failedStatus: SmsNotificationStatus.FAILED,
        ...rangeParameters,
      });

    const [rows, summary] = await Promise.all([
      recentQuery.getRawMany<RecentSmsRow>(),
      summaryQuery.getRawOne<RecentSmsSummaryRow>(),
    ]);

    return {
      items: rows.map((row) => ({
        notificationId: row.notificationId,
        memberName:
          [row.firstName, row.lastName].filter(Boolean).join(' ').trim() ||
          'Unknown client',
        eventType: row.eventType,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        sentAt: row.sentAt,
      })),
      summary: {
        sentToday: Number(summary?.sentToday ?? 0),
        pending: Number(summary?.pending ?? 0),
        failedToday: Number(summary?.failedToday ?? 0),
      },
    };
  }

  async applyUniSmsWebhook(
    receivedSecret: string | undefined,
    payload: {
      id: string;
      event: 'message.sent' | 'message.failed' | 'message.retrying';
      message: {
        reference_id?: string;
        fail_reason?: string | null;
      };
    },
  ): Promise<{ updated: boolean }> {
    this.verifyWebhookSecret(receivedSecret);
    const providerMessageId = payload.message.reference_id || payload.id;
    const repository = this.dataSource.getRepository(SmsNotification);
    const notification = await repository.findOne({
      where: { providerMessageId },
    });
    if (!notification) return { updated: false };

    if (payload.event === 'message.sent') {
      const result = await repository.update(
        {
          id: notification.id,
          status: Not(SmsNotificationStatus.SENT),
        },
        {
          status: SmsNotificationStatus.SENT,
          sentAt: notification.sentAt ?? new Date(),
          lockedAt: null,
          nextAttemptAt: null,
          lastErrorCode: null,
          lastError: null,
        },
      );
      return { updated: result.affected === 1 };
    } else if (payload.event === 'message.failed') {
      const result = await repository.update(
        {
          id: notification.id,
          status: In([
            SmsNotificationStatus.PENDING,
            SmsNotificationStatus.PROCESSING,
          ]),
        },
        {
          status: SmsNotificationStatus.FAILED,
          lockedAt: null,
          nextAttemptAt: null,
          lastErrorCode: 'UNISMS_MESSAGE_FAILED',
          lastError: this.safeError(
            payload.message.fail_reason ||
              'UniSMS reported that the message failed.',
          ),
        },
      );
      return { updated: result.affected === 1 };
    } else if (payload.event === 'message.retrying') {
      const result = await repository.update(
        {
          id: notification.id,
          status: In([
            SmsNotificationStatus.PENDING,
            SmsNotificationStatus.PROCESSING,
          ]),
        },
        {
          status: SmsNotificationStatus.PROCESSING,
          lockedAt: null,
          nextAttemptAt: new Date(Date.now() + 30_000),
          lastErrorCode: 'UNISMS_RETRYING',
          lastError: 'UniSMS is retrying the message.',
        },
      );
      return { updated: result.affected === 1 };
    }

    return { updated: false };
  }

  private async loadLoanCandidate(loanId: string): Promise<SmsCandidate> {
    const row = await this.dataSource
      .getRepository(Loan)
      .createQueryBuilder('loan')
      .innerJoin('loan.borrower', 'member')
      .select('loan.id', 'loanId')
      .addSelect('loan.principalAmount', 'principalAmount')
      .addSelect('member.id', 'memberId')
      .addSelect('member.firstName', 'firstName')
      .addSelect('member.lastName', 'lastName')
      .addSelect('member.contactNumber', 'contactNumber')
      .where('loan.id = :loanId', { loanId })
      .getRawOne<LoanSmsRow>();

    if (!row) throw new NotFoundException('Loan not found');
    const recipient = this.recipientNormalizer.normalize(row.contactNumber);
    return {
      eventType: SmsNotificationEventType.LOAN_CREATED,
      resourceId: row.loanId,
      memberId: row.memberId,
      loanId: row.loanId,
      repaymentId: null,
      memberName: `${row.firstName} ${row.lastName}`.trim(),
      amount: Number(row.principalAmount),
      contactNumber: row.contactNumber,
      recipient: recipient.valid ? recipient.recipient : null,
      recipientMasked: recipient.maskedRecipient,
      eligible: recipient.valid,
      errorCode: recipient.valid ? null : recipient.code,
      errorMessage: recipient.valid ? null : recipient.message,
      message: this.templates.buildLoanCreatedSms({
        clientName: `${row.firstName} ${row.lastName}`.trim(),
        principalAmount: Number(row.principalAmount),
      }),
      idempotencyKey: `loan:${row.loanId}:created`,
    };
  }

  private async loadRepaymentCandidates(
    requestedIds: string[],
  ): Promise<SmsCandidate[]> {
    const repaymentIds = [...new Set(requestedIds)];
    const rows = await this.dataSource
      .getRepository(Repayment)
      .createQueryBuilder('repayment')
      .innerJoin('repayment.member', 'member')
      .innerJoin('repayment.loan', 'loan')
      .innerJoin('loan.borrower', 'loanBorrower')
      .select('repayment.id', 'repaymentId')
      .addSelect('repayment.status', 'status')
      .addSelect('repayment.operationType', 'operationType')
      .addSelect('repayment.amount', 'amount')
      .addSelect('repayment.paymentDate', 'paymentDate')
      .addSelect('repayment.collectionDate', 'collectionDate')
      .addSelect('member.id', 'memberId')
      .addSelect('member.firstName', 'firstName')
      .addSelect('member.lastName', 'lastName')
      .addSelect('member.contactNumber', 'contactNumber')
      .addSelect('loan.id', 'loanId')
      .addSelect('loanBorrower.id', 'loanBorrowerId')
      .where('repayment.id IN (:...repaymentIds)', { repaymentIds })
      .getRawMany<RepaymentSmsRow>();

    const byId = new Map(rows.map((row) => [row.repaymentId, row]));
    return repaymentIds.map((repaymentId) => {
      const row = byId.get(repaymentId);
      if (!row)
        throw new NotFoundException(`Repayment ${repaymentId} not found`);
      const isApprovedPayment =
        row.status === RepaymentStatus.APPROVED &&
        row.operationType === RepaymentOperationType.PAYMENT &&
        row.memberId === row.loanBorrowerId;
      const recipient = this.recipientNormalizer.normalize(row.contactNumber);
      const stateError = isApprovedPayment
        ? null
        : 'Only an approved ordinary payment can receive a repayment SMS.';
      return {
        eventType: SmsNotificationEventType.REPAYMENT_POSTED,
        resourceId: row.repaymentId,
        memberId: row.memberId,
        loanId: row.loanId,
        repaymentId: row.repaymentId,
        memberName: `${row.firstName} ${row.lastName}`.trim(),
        amount: Number(row.amount),
        contactNumber: row.contactNumber,
        recipient: recipient.valid ? recipient.recipient : null,
        recipientMasked: recipient.maskedRecipient,
        eligible: isApprovedPayment && recipient.valid,
        errorCode: !isApprovedPayment
          ? 'NOT_APPROVED_PAYMENT'
          : recipient.valid
            ? null
            : recipient.code,
        errorMessage:
          stateError ?? (recipient.valid ? null : recipient.message),
        message: this.templates.buildRepaymentPostedSms({
          clientName: `${row.firstName} ${row.lastName}`.trim(),
          amount: Number(row.amount),
          paymentDate: row.paymentDate ?? row.collectionDate,
        }),
        idempotencyKey: `repayment:${row.repaymentId}:posted`,
      };
    });
  }

  private async queueCandidates(
    candidates: SmsCandidate[],
    requestedById?: string,
  ): Promise<SmsRequestResult[]> {
    const repository = this.dataSource.getRepository(SmsNotification);
    const keys = candidates.map((item) => item.idempotencyKey);
    const existing = await this.findExisting(keys);
    const createdIds = new Set<string>();
    const values = candidates
      .filter((candidate) => !existing.has(candidate.idempotencyKey))
      .map((candidate) => {
        const id = randomUUID();
        createdIds.add(id);
        return repository.create({
          id,
          eventType: candidate.eventType,
          memberId: candidate.memberId,
          loanId: candidate.loanId,
          repaymentId: candidate.repaymentId,
          requestedById: requestedById ?? null,
          recipient: candidate.recipient,
          message: candidate.message,
          status: candidate.eligible
            ? SmsNotificationStatus.PENDING
            : SmsNotificationStatus.FAILED,
          provider: 'unisms',
          providerMessageId: null,
          idempotencyKey: candidate.idempotencyKey,
          attemptCount: 0,
          lastErrorCode: candidate.errorCode,
          lastError: candidate.errorMessage,
          nextAttemptAt: candidate.eligible ? new Date() : null,
          lockedAt: null,
          sentAt: null,
        });
      });

    if (values.length > 0) {
      await repository
        .createQueryBuilder()
        .insert()
        .into(SmsNotification)
        .values(values)
        .orIgnore()
        .execute();
    }

    const authoritative = await this.findExisting(keys);
    return candidates.map((candidate) => {
      const notification = authoritative.get(candidate.idempotencyKey);
      if (!notification) {
        throw new Error('SMS notification could not be persisted');
      }
      return {
        ...this.toEligibility(candidate, notification),
        eventType: candidate.eventType,
        created: createdIds.has(notification.id),
        status: notification.status,
      } as SmsRequestResult;
    });
  }

  private async findExisting(
    keys: string[],
  ): Promise<Map<string, SmsNotification>> {
    if (keys.length === 0) return new Map();
    const notifications = await this.dataSource
      .getRepository(SmsNotification)
      .find({ where: { idempotencyKey: In(keys) } });
    return new Map(notifications.map((item) => [item.idempotencyKey, item]));
  }

  private toEligibility(
    candidate: SmsCandidate,
    existing?: SmsNotification,
  ): SmsEligibilityItem & { status?: SmsNotificationStatus } {
    return {
      resourceId: candidate.resourceId,
      memberName: candidate.memberName,
      amount: candidate.amount,
      recipientMasked:
        existing?.recipient != null
          ? this.recipientNormalizer.mask(existing.recipient)
          : candidate.recipientMasked,
      eligible: candidate.eligible,
      errorCode: existing?.lastErrorCode ?? candidate.errorCode,
      errorMessage: existing?.lastError ?? candidate.errorMessage,
      notificationId: existing?.id ?? null,
      notificationStatus: existing?.status ?? null,
      status: existing?.status,
    };
  }

  private toStatusResponse(notification: SmsNotification) {
    return {
      notificationId: notification.id,
      eventType: notification.eventType,
      status: notification.status,
      recipientMasked: this.recipientNormalizer.mask(notification.recipient),
      sentAt: notification.sentAt,
      errorCode: notification.lastErrorCode,
      errorMessage: notification.lastError,
    };
  }

  private requireSmsEnabled(): void {
    if (this.config.get<string>('SMS_ENABLED') !== 'true') {
      throw new ServiceUnavailableException({
        code: 'SMS_DISABLED',
        message: 'SMS sending is currently disabled.',
      });
    }
  }

  private verifyWebhookSecret(receivedSecret: string | undefined): void {
    const expected = this.config.get<string>('UNISMS_WEBHOOK_SECRET')?.trim();
    if (!expected) {
      throw new ServiceUnavailableException('UniSMS webhook is not configured');
    }
    const received = receivedSecret ?? '';
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new UnauthorizedException('Invalid UniSMS webhook secret');
    }
  }

  private safeError(value: string): string {
    return value.replace(/[\r\n]/g, ' ').slice(0, 500);
  }
}
