import { ConfigService } from '@nestjs/config';
import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  SmsNotification,
  SmsNotificationEventType,
  SmsNotificationStatus,
} from './entities/sms-notification.entity';
import { NotificationsService } from './notifications.service';
import { SmsProviderError } from './providers/sms-provider';
import { UniSmsProvider } from './providers/unisms.provider';
import { SmsRecipientNormalizer } from './sms-recipient-normalizer';
import { SmsTemplateService } from './sms-template.service';

const candidate = (overrides: Record<string, unknown> = {}) => ({
  eventType: SmsNotificationEventType.REPAYMENT_POSTED,
  resourceId: '11111111-1111-4111-8111-111111111111',
  memberId: '22222222-2222-4222-8222-222222222222',
  loanId: '33333333-3333-4333-8333-333333333333',
  repaymentId: '11111111-1111-4111-8111-111111111111',
  memberName: 'Test Member',
  amount: 1000,
  contactNumber: '09171234567',
  recipient: '+639171234567',
  recipientMasked: '+639****4567',
  eligible: true,
  errorCode: null,
  errorMessage: null,
  message: 'DCLA test message',
  idempotencyKey: 'repayment:11111111-1111-4111-8111-111111111111:posted',
  ...overrides,
});

describe('NotificationsService', () => {
  let store: SmsNotification[];
  let repository: any;
  let service: NotificationsService;
  let configValues: Record<string, string>;
  let uniSmsProvider: { getCredits: jest.Mock };

  beforeEach(() => {
    store = [];
    let pendingValues: SmsNotification[] = [];
    repository = {
      find: jest.fn(async () => [...store]),
      findOne: jest.fn(
        async ({ where }: any) =>
          store.find((item) =>
            where.id
              ? item.id === where.id
              : item.providerMessageId === where.providerMessageId,
          ) ?? null,
      ),
      create: jest.fn((value: SmsNotification) => value),
      save: jest.fn(async (value: SmsNotification) => {
        const index = store.findIndex((item) => item.id === value.id);
        if (index >= 0) store[index] = value;
        else store.push(value);
        return value;
      }),
      update: jest.fn(
        async (
          where: {
            id: string;
            status?: { _type?: string; _value?: string | string[] };
          },
          update: Partial<SmsNotification>,
        ) => {
          const item = store.find((value) => value.id === where.id);
          if (!item) return { affected: 0 };
          if (
            where.status?._type === 'not' &&
            item.status === where.status._value
          ) {
            return { affected: 0 };
          }
          if (
            where.status?._type === 'in' &&
            Array.isArray(where.status._value) &&
            !where.status._value.includes(item.status)
          ) {
            return { affected: 0 };
          }
          Object.assign(item, update);
          return { affected: 1 };
        },
      ),
      createQueryBuilder: jest.fn(() => ({
        insert() {
          return this;
        },
        into() {
          return this;
        },
        values(values: SmsNotification[]) {
          pendingValues = values;
          return this;
        },
        orIgnore() {
          return this;
        },
        async execute() {
          for (const value of pendingValues) {
            if (
              !store.some(
                (item) => item.idempotencyKey === value.idempotencyKey,
              )
            ) {
              store.push(value);
            }
          }
          return {};
        },
      })),
    };
    configValues = {
      SMS_ENABLED: 'true',
      UNISMS_WEBHOOK_SECRET: 'webhook-test-secret',
    };
    const dataSource = {
      getRepository: jest.fn(() => repository),
    } as unknown as DataSource;
    const config = {
      get: jest.fn((key: string) => configValues[key]),
    } as unknown as ConfigService;
    uniSmsProvider = { getCredits: jest.fn() };
    service = new NotificationsService(
      dataSource,
      config,
      new SmsRecipientNormalizer(),
      new SmsTemplateService(),
      uniSmsProvider as unknown as UniSmsProvider,
    );
  });

  it.each([1847, 0])(
    'returns the safe SMS credit contract for %s',
    async (credits) => {
      uniSmsProvider.getCredits.mockResolvedValue({ credits });

      await expect(service.getSmsCredits()).resolves.toEqual({ credits });
    },
  );

  it('maps a malformed provider response to a safe bad gateway error', async () => {
    uniSmsProvider.getCredits.mockRejectedValue(
      new SmsProviderError(
        'UNISMS_INVALID_ACCOUNT_RESPONSE',
        'raw provider detail',
        false,
      ),
    );

    await expect(service.getSmsCredits()).rejects.toEqual(
      new BadGatewayException(
        'SMS credit information is temporarily unavailable.',
      ),
    );
  });

  it('maps provider availability failures to a safe service unavailable error', async () => {
    uniSmsProvider.getCredits.mockRejectedValue(
      new SmsProviderError(
        'UNISMS_AUTHENTICATION_FAILED',
        'secret provider detail',
        false,
      ),
    );

    await expect(service.getSmsCredits()).rejects.toEqual(
      new ServiceUnavailableException(
        'SMS credit information is temporarily unavailable.',
      ),
    );
  });

  it('bulk inserts valid and invalid contacts without failing the valid item', async () => {
    const valid = candidate();
    const invalid = candidate({
      resourceId: '44444444-4444-4444-8444-444444444444',
      repaymentId: '44444444-4444-4444-8444-444444444444',
      recipient: null,
      recipientMasked: null,
      eligible: false,
      errorCode: 'INVALID_CONTACT_NUMBER',
      errorMessage: 'Invalid contact.',
      idempotencyKey: 'repayment:44444444-4444-4444-8444-444444444444:posted',
    });
    jest
      .spyOn(service as any, 'loadRepaymentCandidates')
      .mockResolvedValue([valid, invalid]);

    const result = await service.requestRepaymentBatch([
      valid.resourceId,
      invalid.resourceId,
    ]);

    expect(result.summary).toMatchObject({
      selected: 2,
      queued: 1,
      invalidContact: 1,
    });
    expect(store).toHaveLength(2);
    expect(store.map((item) => item.status)).toEqual([
      SmsNotificationStatus.PENDING,
      SmsNotificationStatus.FAILED,
    ]);
  });

  it('reuses the same notification for duplicate browser requests', async () => {
    const item = candidate();
    jest
      .spyOn(service as any, 'loadRepaymentCandidates')
      .mockResolvedValue([item]);

    const first = await service.requestRepaymentSms(item.resourceId);
    const second = await service.requestRepaymentSms(item.resourceId);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.notificationId).toBe(first.notificationId);
    expect(store).toHaveLength(1);
  });

  it('rejects a pending, rejected, reversal, or mismatched repayment', async () => {
    const item = candidate({
      eligible: false,
      errorCode: 'NOT_APPROVED_PAYMENT',
      errorMessage:
        'Only an approved ordinary payment can receive a repayment SMS.',
    });
    jest
      .spyOn(service as any, 'loadRepaymentCandidates')
      .mockResolvedValue([item]);
    await expect(service.requestRepaymentSms(item.resourceId)).rejects.toThrow(
      'Only an approved ordinary payment',
    );
    expect(store).toHaveLength(0);
  });

  it('does not queue anything while SMS is disabled', async () => {
    configValues.SMS_ENABLED = 'false';
    await expect(
      service.requestRepaymentSms(candidate().resourceId),
    ).rejects.toThrow('SMS sending is currently disabled.');
    expect(store).toHaveLength(0);
  });

  it.each([
    ['message.sent', SmsNotificationStatus.SENT],
    ['message.failed', SmsNotificationStatus.FAILED],
    ['message.retrying', SmsNotificationStatus.PROCESSING],
  ] as const)('applies verified UniSMS webhook %s', async (event, expected) => {
    store.push({
      ...candidate(),
      id: '55555555-5555-4555-8555-555555555555',
      providerMessageId: 'msg_test',
      status: SmsNotificationStatus.PROCESSING,
      lockedAt: null,
      nextAttemptAt: null,
      sentAt: null,
      lastErrorCode: null,
      lastError: null,
    } as unknown as SmsNotification);

    await service.applyUniSmsWebhook('webhook-test-secret', {
      id: 'msg_test',
      event,
      message: { reference_id: 'msg_test', fail_reason: 'provider reason' },
    });
    expect(store[0].status).toBe(expected);
  });

  it('rejects an invalid webhook secret', async () => {
    await expect(
      service.applyUniSmsWebhook('wrong', {
        id: 'msg_test',
        event: 'message.sent',
        message: { reference_id: 'msg_test' },
      }),
    ).rejects.toThrow('Invalid UniSMS webhook secret');
  });

  it('treats a repeated sent webhook as a no-op and preserves sentAt', async () => {
    const originalSentAt = new Date('2026-08-27T01:02:03.000Z');
    store.push({
      ...candidate(),
      id: '55555555-5555-4555-8555-555555555555',
      providerMessageId: 'msg_test',
      status: SmsNotificationStatus.SENT,
      lockedAt: null,
      nextAttemptAt: null,
      sentAt: originalSentAt,
      lastErrorCode: null,
      lastError: null,
    } as unknown as SmsNotification);

    const result = await service.applyUniSmsWebhook('webhook-test-secret', {
      id: 'msg_test',
      event: 'message.sent',
      message: { reference_id: 'msg_test' },
    });

    expect(result).toEqual({ updated: false });
    expect(store[0].status).toBe(SmsNotificationStatus.SENT);
    expect(store[0].sentAt).toBe(originalSentAt);
  });

  it.each(['message.failed', 'message.retrying'] as const)(
    'does not let %s regress a sent notification',
    async (event) => {
      const originalSentAt = new Date('2026-08-27T01:02:03.000Z');
      store.push({
        ...candidate(),
        id: '55555555-5555-4555-8555-555555555555',
        providerMessageId: 'msg_test',
        status: SmsNotificationStatus.SENT,
        lockedAt: null,
        nextAttemptAt: null,
        sentAt: originalSentAt,
        lastErrorCode: null,
        lastError: null,
      } as unknown as SmsNotification);

      const result = await service.applyUniSmsWebhook('webhook-test-secret', {
        id: 'msg_test',
        event,
        message: {
          reference_id: 'msg_test',
          fail_reason: 'Late provider event',
        },
      });

      expect(result).toEqual({ updated: false });
      expect(store[0].status).toBe(SmsNotificationStatus.SENT);
      expect(store[0].sentAt).toBe(originalSentAt);
      expect(store[0].lastError).toBeNull();
    },
  );
});
