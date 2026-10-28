import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { RepaymentsController } from './repayments.controller';
import { RepaymentsService } from './repayments.service';

describe('RepaymentsController validation', () => {
  let app: INestApplication;
  let httpServer: App;
  const service = {
    create: jest.fn().mockResolvedValue({ id: 'repayment-id' }),
    getScheduleForLoan: jest.fn().mockResolvedValue([]),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [RepaymentsController],
      providers: [{ provide: RepaymentsService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    httpServer = app.getHttpServer() as App;
  });

  afterAll(async () => app.close());

  it('accepts the existing zero-cash plus savings repayment payload', async () => {
    const payload = {
      loanId: '00000000-0000-4000-8000-000000000001',
      memberId: '00000000-0000-4000-8000-000000000002',
      centerId: '00000000-0000-4000-8000-000000000003',
      amount: 0,
      collectionDate: '2026-09-05',
      useSavings: true,
    };

    await request(httpServer)
      .post('/repayments')
      .send(payload)
      .expect(201, { id: 'repayment-id' });
    expect(service.create).toHaveBeenCalledWith(payload, undefined);
  });

  it('rejects invalid UUIDs and unexpected mutation fields', async () => {
    await request(httpServer)
      .post('/repayments')
      .send({
        loanId: 'not-a-uuid',
        memberId: '00000000-0000-4000-8000-000000000002',
        centerId: '00000000-0000-4000-8000-000000000003',
        amount: 100,
        approvedById: 'spoofed-actor',
      })
      .expect(400);
  });

  it('returns 400 for an invalid UUID route parameter', async () => {
    await request(httpServer)
      .get('/repayments/loan/not-a-uuid/schedule')
      .expect(400);
  });
});
