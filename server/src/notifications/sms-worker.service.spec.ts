import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  SmsNotification,
  SmsNotificationEventType,
  SmsNotificationStatus,
} from './entities/sms-notification.entity';
import { FakeSmsProvider } from './providers/fake-sms.provider';
import { SmsProviderError } from './providers/sms-provider';
import { SmsWorkerService } from './sms-worker.service';

const notification = (): SmsNotification =>
  ({
    id: '11111111-1111-4111-8111-111111111111',
    eventType: SmsNotificationEventType.LOAN_CREATED,
    recipient: '+639171234567',
    message: 'Test message',
    idempotencyKey: 'loan:loan-id:created',
    status: SmsNotificationStatus.PROCESSING,
    attemptCount: 1,
    providerMessageId: null,
    lockedAt: new Date('2026-08-27T00:00:00.000Z'),
  }) as SmsNotification;

describe('SmsWorkerService', () => {
  let updates: Array<Record<string, unknown>>;
  let provider: FakeSmsProvider;
  let worker: SmsWorkerService;

  beforeEach(() => {
    updates = [];
    const repository = {
      createQueryBuilder: jest.fn(() => {
        let values: Record<string, unknown> = {};
        return {
          update() {
            return this;
          },
          set(update: Record<string, unknown>) {
            values = update;
            return this;
          },
          where() {
            return this;
          },
          andWhere() {
            return this;
          },
          async execute() {
            updates.push(values);
            return { affected: 1 };
          },
        };
      }),
    };
    const dataSource = {
      getRepository: jest.fn(() => repository),
    } as unknown as DataSource;
    const config = {
      get: jest.fn((key: string) =>
        key === 'SMS_ENABLED' || key === 'SMS_WORKER_ENABLED'
          ? 'true'
          : undefined,
      ),
    } as unknown as ConfigService;
    provider = new FakeSmsProvider();
    worker = new SmsWorkerService(dataSource, config, provider);
    jest
      .spyOn(worker as any, 'claimSendRows')
      .mockResolvedValue([notification()]);
    jest.spyOn(worker as any, 'claimStatusRows').mockResolvedValue([]);
  });

  it('marks a FakeSmsProvider success as sent', async () => {
    await worker.pollOnce();
    expect(provider.sent).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      status: SmsNotificationStatus.SENT,
      providerMessageId: 'fake-message-id',
    });
  });

  it('returns a transient timeout to pending with a bounded retry', async () => {
    jest
      .spyOn(provider, 'send')
      .mockRejectedValue(
        new SmsProviderError('UNISMS_TIMEOUT', 'Timed out.', true),
      );
    await worker.pollOnce();
    expect(updates[0]).toMatchObject({
      status: SmsNotificationStatus.PENDING,
      lastErrorCode: 'UNISMS_TIMEOUT',
    });
    expect(updates[0].nextAttemptAt).toBeInstanceOf(Date);
  });

  it('marks a permanent provider failure as failed', async () => {
    jest
      .spyOn(provider, 'send')
      .mockRejectedValue(
        new SmsProviderError(
          'UNISMS_AUTHENTICATION_FAILED',
          'Bad auth.',
          false,
        ),
      );
    await worker.pollOnce();
    expect(updates[0]).toMatchObject({
      status: SmsNotificationStatus.FAILED,
      lastErrorCode: 'UNISMS_AUTHENTICATION_FAILED',
      nextAttemptAt: null,
    });
  });

  it('uses SKIP LOCKED for both bounded worker claim queries', async () => {
    const setOnLocked = jest.fn().mockReturnThis();
    const queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      setOnLocked,
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const repository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      save: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn(async (callback: (manager: any) => unknown) =>
        callback({ getRepository: () => repository }),
      ),
      getRepository: jest.fn(() => ({ update: jest.fn() })),
    } as unknown as DataSource;
    const config = {
      get: jest.fn((key: string) =>
        key === 'SMS_ENABLED' || key === 'SMS_WORKER_ENABLED'
          ? 'true'
          : undefined,
      ),
    } as unknown as ConfigService;
    const lockingWorker = new SmsWorkerService(dataSource, config, provider);

    await lockingWorker.pollOnce();
    expect(setOnLocked).toHaveBeenCalledTimes(2);
    expect(setOnLocked).toHaveBeenNthCalledWith(1, 'skip_locked');
    expect(queryBuilder.take).toHaveBeenCalledWith(20);
  });

  it('reclaims a stale status lease and reconciles provider status', async () => {
    const row = {
      ...notification(),
      providerMessageId: 'msg_stale',
      lockedAt: new Date(Date.now() - 120_000),
      nextAttemptAt: new Date(Date.now() - 1_000),
    } as SmsNotification;
    const andWhereCalls: Array<[string, Record<string, unknown> | undefined]> =
      [];
    const repository = {
      createQueryBuilder: jest.fn(() => {
        let values: Partial<SmsNotification> = {};
        let ids: string[] | null = null;
        return {
          setLock() {
            return this;
          },
          setOnLocked() {
            return this;
          },
          where() {
            return this;
          },
          andWhere(sql: string, parameters?: Record<string, unknown>) {
            andWhereCalls.push([sql, parameters]);
            return this;
          },
          orderBy() {
            return this;
          },
          take() {
            return this;
          },
          async getMany() {
            const staleBefore = andWhereCalls
              .map(([, parameters]) => parameters?.staleBefore)
              .find((value) => value instanceof Date) as Date;
            return row.lockedAt == null || row.lockedAt <= staleBefore
              ? [row]
              : [];
          },
          update() {
            return this;
          },
          set(update: Partial<SmsNotification>) {
            values = update;
            return this;
          },
          whereInIds(nextIds: string[]) {
            ids = nextIds;
            return this;
          },
          async execute() {
            if (ids?.includes(row.id) || ids === null)
              Object.assign(row, values);
            return { affected: 1 };
          },
        };
      }),
    };
    const dataSource = {
      transaction: jest.fn(async (callback: (manager: any) => unknown) =>
        callback({ getRepository: () => repository }),
      ),
      getRepository: jest.fn(() => repository),
    } as unknown as DataSource;
    const config = {
      get: jest.fn((key: string) =>
        key === 'SMS_ENABLED' || key === 'SMS_WORKER_ENABLED'
          ? 'true'
          : undefined,
      ),
    } as unknown as ConfigService;
    const statusProvider = new FakeSmsProvider();
    statusProvider.result = {
      providerMessageId: 'msg_stale',
      status: 'sent',
    };
    const statusWorker = new SmsWorkerService(
      dataSource,
      config,
      statusProvider,
    );
    jest.spyOn(statusWorker as any, 'claimSendRows').mockResolvedValue([]);
    const getStatus = jest.spyOn(statusProvider, 'getStatus');

    await statusWorker.pollOnce();

    expect(getStatus).toHaveBeenCalledWith('msg_stale');
    expect(row.status).toBe(SmsNotificationStatus.SENT);
    expect(row.lockedAt).toBeNull();
    expect(
      andWhereCalls.some(([sql]) =>
        sql.includes('notification.lockedAt <= :staleBefore'),
      ),
    ).toBe(true);
  });

  it('does not steal a fresh status lease', async () => {
    const row = {
      ...notification(),
      providerMessageId: 'msg_fresh',
      lockedAt: new Date(),
      nextAttemptAt: new Date(Date.now() - 1_000),
    } as SmsNotification;
    let staleBefore: Date | undefined;
    const queryBuilder = {
      setLock() {
        return this;
      },
      setOnLocked() {
        return this;
      },
      where() {
        return this;
      },
      andWhere(_sql: string, parameters?: { staleBefore?: Date }) {
        staleBefore = parameters?.staleBefore ?? staleBefore;
        return this;
      },
      orderBy() {
        return this;
      },
      take() {
        return this;
      },
      async getMany() {
        return staleBefore && row.lockedAt! <= staleBefore ? [row] : [];
      },
    };
    const dataSource = {
      transaction: jest.fn(async (callback: (manager: any) => unknown) =>
        callback({
          getRepository: () => ({
            createQueryBuilder: () => queryBuilder,
          }),
        }),
      ),
    } as unknown as DataSource;
    const config = {
      get: jest.fn((key: string) =>
        key === 'SMS_ENABLED' || key === 'SMS_WORKER_ENABLED'
          ? 'true'
          : undefined,
      ),
    } as unknown as ConfigService;
    const statusProvider = new FakeSmsProvider();
    const getStatus = jest.spyOn(statusProvider, 'getStatus');
    const statusWorker = new SmsWorkerService(
      dataSource,
      config,
      statusProvider,
    );
    jest.spyOn(statusWorker as any, 'claimSendRows').mockResolvedValue([]);

    await statusWorker.pollOnce();

    expect(getStatus).not.toHaveBeenCalled();
    expect(row.status).toBe(SmsNotificationStatus.PROCESSING);
    expect(row.lockedAt).not.toBeNull();
  });

  it('does not let a stale polling result overwrite a concurrent sent state', async () => {
    const claimedAt = new Date('2026-08-27T00:00:00.000Z');
    const claimed = {
      ...notification(),
      providerMessageId: 'msg_race',
      lockedAt: claimedAt,
    } as SmsNotification;
    const originalSentAt = new Date('2026-08-27T00:00:01.000Z');
    const persisted = {
      ...claimed,
      status: SmsNotificationStatus.SENT,
      lockedAt: null,
      sentAt: originalSentAt,
    };
    const conditions: string[] = [];
    let values: Partial<SmsNotification> = {};
    const repository = {
      createQueryBuilder: jest.fn(() => ({
        update() {
          return this;
        },
        set(update: Partial<SmsNotification>) {
          values = update;
          return this;
        },
        where(sql: string) {
          conditions.push(sql);
          return this;
        },
        andWhere(sql: string) {
          conditions.push(sql);
          return this;
        },
        async execute() {
          const ownsClaim =
            persisted.status === SmsNotificationStatus.PROCESSING &&
            (persisted.lockedAt as Date | null)?.getTime() ===
              claimedAt.getTime();
          if (ownsClaim) Object.assign(persisted, values);
          return { affected: ownsClaim ? 1 : 0 };
        },
      })),
    };
    const dataSource = {
      getRepository: jest.fn(() => repository),
    } as unknown as DataSource;
    const config = {
      get: jest.fn((key: string) =>
        key === 'SMS_ENABLED' || key === 'SMS_WORKER_ENABLED'
          ? 'true'
          : undefined,
      ),
    } as unknown as ConfigService;
    const statusProvider = new FakeSmsProvider();
    statusProvider.result = {
      providerMessageId: 'msg_race',
      status: 'failed',
      failureReason: 'Late stale failure',
    };
    const statusWorker = new SmsWorkerService(
      dataSource,
      config,
      statusProvider,
    );
    jest.spyOn(statusWorker as any, 'claimSendRows').mockResolvedValue([]);
    jest
      .spyOn(statusWorker as any, 'claimStatusRows')
      .mockResolvedValue([claimed]);

    await statusWorker.pollOnce();

    expect(conditions).toContain('status = :processing');
    expect(conditions).toContain('"lockedAt" = :lockedAt');
    expect(persisted.status).toBe(SmsNotificationStatus.SENT);
    expect(persisted.sentAt).toBe(originalSentAt);
    expect(persisted.lastError).not.toBe('Late stale failure');
  });
});
