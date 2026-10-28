import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  SmsNotificationEventType,
  SmsNotificationStatus,
} from './entities/sms-notification.entity';
import { NotificationsService } from './notifications.service';
import { UniSmsProvider } from './providers/unisms.provider';
import { SmsRecipientNormalizer } from './sms-recipient-normalizer';
import { SmsTemplateService } from './sms-template.service';

const fluentBuilder = () => {
  const builder: Record<string, jest.Mock> = {};
  for (const method of [
    'leftJoin',
    'select',
    'addSelect',
    'orderBy',
    'addOrderBy',
    'limit',
    'setParameters',
  ]) {
    builder[method] = jest.fn(() => builder);
  }
  return builder;
};

describe('NotificationsService recent SMS activity', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-01T00:30:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('returns bounded newest-first items and one aggregate summary', async () => {
    const recentBuilder = fluentBuilder();
    const summaryBuilder = fluentBuilder();
    recentBuilder.getRawMany = jest.fn().mockResolvedValue([
      {
        notificationId: '22222222-2222-4222-8222-222222222222',
        eventType: SmsNotificationEventType.REPAYMENT_POSTED,
        status: SmsNotificationStatus.SENT,
        createdAt: new Date('2026-09-01T00:20:00.000Z'),
        updatedAt: new Date('2026-09-01T00:21:00.000Z'),
        sentAt: new Date('2026-09-01T00:21:00.000Z'),
        firstName: 'Maria',
        lastName: 'Santos',
      },
      {
        notificationId: '11111111-1111-4111-8111-111111111111',
        eventType: SmsNotificationEventType.LOAN_CREATED,
        status: SmsNotificationStatus.FAILED,
        createdAt: new Date('2026-09-01T00:10:00.000Z'),
        updatedAt: new Date('2026-09-01T00:11:00.000Z'),
        sentAt: null,
        firstName: null,
        lastName: null,
      },
    ]);
    summaryBuilder.getRawOne = jest.fn().mockResolvedValue({
      sentToday: '24',
      pending: '2',
      failedToday: '1',
    });

    const repository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(recentBuilder)
        .mockReturnValueOnce(summaryBuilder),
    };
    const dataSource = {
      getRepository: jest.fn(() => repository),
    } as unknown as DataSource;
    const service = new NotificationsService(
      dataSource,
      {} as ConfigService,
      new SmsRecipientNormalizer(),
      new SmsTemplateService(),
      {} as UniSmsProvider,
    );

    const result = await service.getRecentSms(10);

    expect(recentBuilder.leftJoin).toHaveBeenCalledWith(
      'notification.member',
      'member',
    );
    expect(recentBuilder.orderBy).toHaveBeenCalledWith(
      'notification.createdAt',
      'DESC',
    );
    expect(recentBuilder.addOrderBy).toHaveBeenCalledWith(
      'notification.id',
      'DESC',
    );
    expect(recentBuilder.limit).toHaveBeenCalledWith(10);
    expect(result.items.map((item) => item.notificationId)).toEqual([
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
    ]);
    expect(result.items[0].memberName).toBe('Maria Santos');
    expect(result.items[1].memberName).toBe('Unknown client');
    expect(Object.keys(result.items[0])).toEqual([
      'notificationId',
      'memberName',
      'eventType',
      'status',
      'createdAt',
      'updatedAt',
      'sentAt',
    ]);
    expect(result.summary).toEqual({
      sentToday: 24,
      pending: 2,
      failedToday: 1,
    });
    expect(repository.createQueryBuilder).toHaveBeenCalledTimes(2);
  });

  it.each([10, 25])(
    'generates a PostgreSQL LIMIT %i after the newest-first ordering for a joined raw query',
    (limit) => {
      const dataSource = new DataSource({
        type: 'postgres',
        database: 'unused',
        username: 'unused',
        password: 'unused',
      });
      const query = dataSource
        .createQueryBuilder()
        .select('notification.id', 'notificationId')
        .from('sms_notification', 'notification')
        .leftJoin('member', 'member', 'member.id = notification.memberId')
        .orderBy('notification.createdAt', 'DESC')
        .addOrderBy('notification.id', 'DESC')
        .limit(limit);

      expect(query.getSql()).toMatch(
        new RegExp(`ORDER BY .+ DESC, .+ DESC LIMIT ${limit}$`),
      );
    },
  );

  it('uses sentAt, open queue statuses, and failed updatedAt at Manila bounds', async () => {
    const recentBuilder = fluentBuilder();
    const summaryBuilder = fluentBuilder();
    recentBuilder.getRawMany = jest.fn().mockResolvedValue([]);
    summaryBuilder.getRawOne = jest.fn().mockResolvedValue(undefined);
    const repository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(recentBuilder)
        .mockReturnValueOnce(summaryBuilder),
    };
    const service = new NotificationsService(
      { getRepository: jest.fn(() => repository) } as unknown as DataSource,
      {} as ConfigService,
      new SmsRecipientNormalizer(),
      new SmsTemplateService(),
      {} as UniSmsProvider,
    );

    await service.getRecentSms();

    const selectCalls = summaryBuilder.select.mock.calls as unknown as Array<
      [string, string]
    >;
    const addSelectCalls = summaryBuilder.addSelect.mock
      .calls as unknown as Array<[string, string]>;
    const summarySql = [
      selectCalls[0][0],
      ...addSelectCalls.map(([sql]) => sql),
    ].join(' ');
    expect(summarySql).toContain('notification.sentAt >= :startUtc');
    expect(summarySql).toContain(
      'notification.status IN (:...pendingStatuses)',
    );
    expect(summarySql).toContain('notification.updatedAt >= :startUtc');
    expect(summaryBuilder.setParameters).toHaveBeenCalledWith({
      sentStatus: SmsNotificationStatus.SENT,
      pendingStatuses: [
        SmsNotificationStatus.PENDING,
        SmsNotificationStatus.PROCESSING,
      ],
      failedStatus: SmsNotificationStatus.FAILED,
      startUtc: '2026-08-31 16:00:00.000',
      endUtc: '2026-09-01 16:00:00.000',
    });
  });
});
