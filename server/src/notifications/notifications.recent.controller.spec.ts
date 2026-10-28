import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ServiceUnavailableException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { ROLE } from '../auth/roles.constants';
import { RolesGuard } from '../auth/roles.guard';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController recent SMS route', () => {
  let app: INestApplication<App>;
  const response = {
    items: [],
    summary: { sentToday: 0, pending: 0, failedToday: 0 },
  };
  const notifications = {
    getRecentSms: jest.fn().mockResolvedValue(response),
    getSmsCredits: jest.fn().mockResolvedValue({ credits: 1847 }),
    getStatus: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: notifications }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    const roleHeaderGuard: CanActivate = {
      canActivate(context: ExecutionContext): boolean {
        const requestContext = context.switchToHttp().getRequest<{
          headers: Record<string, string | undefined>;
          user?: { role: string };
        }>();
        const role = requestContext.headers['x-test-role'];
        if (role) requestContext.user = { role };
        return true;
      },
    };
    app.useGlobalGuards(roleHeaderGuard, new RolesGuard(app.get(Reflector)));
    await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    notifications.getSmsCredits.mockResolvedValue({ credits: 1847 });
  });

  it('resolves /recent before the dynamic notification ID route', async () => {
    await request(app.getHttpServer())
      .get('/notifications/sms/recent')
      .set('x-test-role', ROLE.Manager)
      .expect(200, response);

    expect(notifications.getRecentSms).toHaveBeenCalledWith(10);
    expect(notifications.getStatus).not.toHaveBeenCalled();
  });

  it('coerces and accepts the maximum limit', async () => {
    await request(app.getHttpServer())
      .get('/notifications/sms/recent?limit=25')
      .set('x-test-role', ROLE.Manager)
      .expect(200);

    expect(notifications.getRecentSms).toHaveBeenCalledWith(25);
  });

  it('resolves /credits before the dynamic notification ID route', async () => {
    await request(app.getHttpServer())
      .get('/notifications/sms/credits')
      .set('x-test-role', ROLE.Manager)
      .expect(200, { credits: 1847 });

    expect(notifications.getSmsCredits).toHaveBeenCalledTimes(1);
    expect(notifications.getStatus).not.toHaveBeenCalled();
  });

  it('preserves a valid zero credit balance', async () => {
    notifications.getSmsCredits.mockResolvedValueOnce({ credits: 0 });

    await request(app.getHttpServer())
      .get('/notifications/sms/credits')
      .set('x-test-role', ROLE.Manager)
      .expect(200, { credits: 0 });
  });

  it('returns a safe provider unavailable response', async () => {
    notifications.getSmsCredits.mockRejectedValueOnce(
      new ServiceUnavailableException(
        'SMS credit information is temporarily unavailable.',
      ),
    );

    const result = await request(app.getHttpServer())
      .get('/notifications/sms/credits')
      .set('x-test-role', ROLE.Manager)
      .expect(503);

    expect(result.body).toMatchObject({
      statusCode: 503,
      message: 'SMS credit information is temporarily unavailable.',
    });
    expect(JSON.stringify(result.body)).not.toContain('secret');
  });

  it.each(['0', '26', 'not-a-number'])(
    'rejects invalid limit %s',
    async (limit) => {
      await request(app.getHttpServer())
        .get(`/notifications/sms/recent?limit=${limit}`)
        .set('x-test-role', ROLE.Manager)
        .expect(400);
      expect(notifications.getRecentSms).not.toHaveBeenCalled();
    },
  );

  it.each([ROLE.Manager, ROLE.Admin])('allows the %s role', async (role) => {
    await request(app.getHttpServer())
      .get('/notifications/sms/recent')
      .set('x-test-role', role)
      .expect(200);
  });

  it.each([ROLE.Manager, ROLE.Admin])(
    'allows the %s role to read SMS credits',
    async (role) => {
      await request(app.getHttpServer())
        .get('/notifications/sms/credits')
        .set('x-test-role', role)
        .expect(200, { credits: 1847 });
    },
  );

  it.each([ROLE.Cashier, ROLE.LoanProcessor])(
    'rejects the %s role from SMS credits',
    async (role) => {
      await request(app.getHttpServer())
        .get('/notifications/sms/credits')
        .set('x-test-role', role)
        .expect(403);
    },
  );

  it.each([undefined, ROLE.LoanProcessor])(
    'rejects an unauthorized role %s',
    async (role) => {
      const call = request(app.getHttpServer()).get(
        '/notifications/sms/recent',
      );
      if (role) call.set('x-test-role', role);
      await call.expect(403);
    },
  );
});
