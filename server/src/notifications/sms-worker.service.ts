import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Brackets, DataSource } from 'typeorm';
import {
  SmsNotification,
  SmsNotificationStatus,
} from './entities/sms-notification.entity';
import {
  SMS_PROVIDER,
  SmsProvider,
  SmsProviderError,
  SmsProviderResult,
} from './providers/sms-provider';

@Injectable()
export class SmsWorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(SmsWorkerService.name);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopping = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @Inject(SMS_PROVIDER) private readonly provider: SmsProvider,
  ) {}

  onApplicationBootstrap(): void {
    if (this.isEnabled()) this.schedule(0);
  }

  onApplicationShutdown(): void {
    this.stopping = true;
    if (this.timer) clearTimeout(this.timer);
  }

  async pollOnce(): Promise<void> {
    if (!this.isEnabled()) return;
    const sendRows = await this.claimSendRows();
    await Promise.allSettled(sendRows.map((row) => this.send(row)));
    const statusRows = await this.claimStatusRows();
    await Promise.allSettled(statusRows.map((row) => this.refreshStatus(row)));
  }

  private schedule(delay: number): void {
    if (this.stopping) return;
    this.timer = setTimeout(() => {
      void this.runScheduledPoll();
    }, delay);
    this.timer.unref?.();
  }

  private async runScheduledPoll(): Promise<void> {
    try {
      await this.pollOnce();
    } catch (error) {
      this.logger.error(
        'SMS worker poll failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.schedule(this.numberConfig('SMS_POLL_INTERVAL_MS', 5_000));
    }
  }

  private async claimSendRows(): Promise<SmsNotification[]> {
    const now = new Date();
    const staleBefore = new Date(
      now.getTime() - this.numberConfig('SMS_PROCESSING_LEASE_MS', 60_000),
    );
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SmsNotification);
      const rows = await repository
        .createQueryBuilder('notification')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where(
          new Brackets((qb) => {
            qb.where(
              'notification.status = :pending AND (notification.nextAttemptAt IS NULL OR notification.nextAttemptAt <= :now)',
              { pending: SmsNotificationStatus.PENDING, now },
            ).orWhere(
              'notification.status = :processing AND notification.providerMessageId IS NULL AND notification.lockedAt <= :staleBefore',
              {
                processing: SmsNotificationStatus.PROCESSING,
                staleBefore,
              },
            );
          }),
        )
        .andWhere('notification.attemptCount < :maxAttempts', {
          maxAttempts: this.numberConfig('SMS_MAX_ATTEMPTS', 5),
        })
        .orderBy('notification.createdAt', 'ASC')
        .take(this.numberConfig('SMS_WORKER_BATCH_SIZE', 20))
        .getMany();

      for (const row of rows) {
        row.status = SmsNotificationStatus.PROCESSING;
        row.lockedAt = now;
        row.attemptCount += 1;
      }
      if (rows.length) {
        await repository
          .createQueryBuilder()
          .update(SmsNotification)
          .set({
            status: SmsNotificationStatus.PROCESSING,
            lockedAt: now,
            attemptCount: () => '"attemptCount" + 1',
          })
          .whereInIds(rows.map((row) => row.id))
          .execute();
      }
      return rows;
    });
  }

  private async claimStatusRows(): Promise<SmsNotification[]> {
    const now = new Date();
    const staleBefore = new Date(
      now.getTime() - this.numberConfig('SMS_PROCESSING_LEASE_MS', 60_000),
    );
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SmsNotification);
      const rows = await repository
        .createQueryBuilder('notification')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('notification.status = :processing', {
          processing: SmsNotificationStatus.PROCESSING,
        })
        .andWhere('notification.providerMessageId IS NOT NULL')
        .andWhere(
          '(notification.nextAttemptAt IS NULL OR notification.nextAttemptAt <= :now)',
          { now },
        )
        .andWhere(
          '(notification.lockedAt IS NULL OR notification.lockedAt <= :staleBefore)',
          { staleBefore },
        )
        .orderBy('notification.createdAt', 'ASC')
        .take(this.numberConfig('SMS_WORKER_BATCH_SIZE', 20))
        .getMany();
      for (const row of rows) row.lockedAt = now;
      if (rows.length) {
        await repository
          .createQueryBuilder()
          .update(SmsNotification)
          .set({ lockedAt: now })
          .whereInIds(rows.map((row) => row.id))
          .execute();
      }
      return rows;
    });
  }

  private async send(notification: SmsNotification): Promise<void> {
    try {
      if (!notification.recipient) {
        throw new SmsProviderError(
          'INVALID_CONTACT_NUMBER',
          'SMS recipient is invalid.',
          false,
        );
      }
      const result = await this.provider.send({
        recipient: notification.recipient,
        content: notification.message,
        notificationId: notification.id,
        idempotencyKey: notification.idempotencyKey,
      });
      await this.applyProviderResult(notification, result);
    } catch (error) {
      await this.applySendFailure(notification, error);
    }
  }

  private async refreshStatus(notification: SmsNotification): Promise<void> {
    try {
      const result = await this.provider.getStatus(
        notification.providerMessageId!,
      );
      await this.applyProviderResult(notification, result);
    } catch (error) {
      await this.updateClaimedProcessing(notification, {
        lockedAt: null,
        nextAttemptAt: new Date(Date.now() + 60_000),
        lastErrorCode:
          error instanceof SmsProviderError
            ? error.code
            : 'UNISMS_STATUS_CHECK_FAILED',
        lastError:
          error instanceof Error
            ? error.message.slice(0, 500)
            : 'UniSMS status check failed.',
      });
    }
  }

  private async applyProviderResult(
    notification: SmsNotification,
    result: SmsProviderResult,
  ): Promise<void> {
    if (result.status === 'sent') {
      await this.updateClaimedProcessing(notification, {
        status: SmsNotificationStatus.SENT,
        providerMessageId: result.providerMessageId,
        sentAt: new Date(),
        lockedAt: null,
        nextAttemptAt: null,
        lastErrorCode: null,
        lastError: null,
      });
    } else if (result.status === 'failed') {
      await this.updateClaimedProcessing(notification, {
        status: SmsNotificationStatus.FAILED,
        providerMessageId: result.providerMessageId,
        lockedAt: null,
        nextAttemptAt: null,
        lastErrorCode: 'UNISMS_MESSAGE_FAILED',
        lastError: (result.failureReason || 'UniSMS reported failure.').slice(
          0,
          500,
        ),
      });
    } else {
      await this.updateClaimedProcessing(notification, {
        status: SmsNotificationStatus.PROCESSING,
        providerMessageId: result.providerMessageId,
        lockedAt: null,
        nextAttemptAt: new Date(Date.now() + 30_000),
        lastErrorCode: result.status === 'retrying' ? 'UNISMS_RETRYING' : null,
        lastError:
          result.status === 'retrying'
            ? 'UniSMS is retrying the message.'
            : null,
      });
    }
  }

  private async applySendFailure(
    notification: SmsNotification,
    error: unknown,
  ): Promise<void> {
    const providerError =
      error instanceof SmsProviderError
        ? error
        : new SmsProviderError(
            'SMS_SEND_FAILED',
            error instanceof Error ? error.message : 'SMS send failed.',
            true,
          );
    const maxAttempts = this.numberConfig('SMS_MAX_ATTEMPTS', 5);
    const retry =
      providerError.retryable && notification.attemptCount < maxAttempts;
    await this.updateClaimedProcessing(notification, {
      status: retry
        ? SmsNotificationStatus.PENDING
        : SmsNotificationStatus.FAILED,
      lockedAt: null,
      nextAttemptAt: retry
        ? new Date(Date.now() + this.retryDelay(notification.attemptCount))
        : null,
      lastErrorCode: providerError.code,
      lastError: providerError.message.slice(0, 500),
    });
  }

  private async updateClaimedProcessing(
    notification: SmsNotification,
    update: Partial<SmsNotification>,
  ): Promise<void> {
    const query = this.dataSource
      .getRepository(SmsNotification)
      .createQueryBuilder()
      .update(SmsNotification)
      .set(update)
      .where('id = :id', { id: notification.id })
      .andWhere('status = :processing', {
        processing: SmsNotificationStatus.PROCESSING,
      });

    if (notification.lockedAt) {
      query.andWhere('"lockedAt" = :lockedAt', {
        lockedAt: notification.lockedAt,
      });
    } else {
      query.andWhere('"lockedAt" IS NULL');
    }

    await query.execute();
  }

  private retryDelay(attempt: number): number {
    const delays = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
    return delays[Math.min(Math.max(attempt - 1, 0), delays.length - 1)];
  }

  private isEnabled(): boolean {
    return (
      this.config.get<string>('SMS_ENABLED') === 'true' &&
      this.config.get<string>('SMS_WORKER_ENABLED') === 'true'
    );
  }

  private numberConfig(key: string, fallback: number): number {
    const value = Number(this.config.get<string>(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
