import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

describe('CollectionsController', () => {
  let controller: CollectionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectionsController],
      providers: [{ provide: CollectionsService, useValue: {} }],
    }).compile();

    controller = module.get<CollectionsController>(CollectionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

describe('CollectionsController validation', () => {
  let app: INestApplication;
  let httpServer: App;
  const service = {
    autoGenerateCollections: jest.fn().mockResolvedValue([]),
    updatePayment: jest.fn().mockResolvedValue({ id: 'collection-id' }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CollectionsController],
      providers: [{ provide: CollectionsService, useValue: service }],
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

  it('accepts the existing auto-generate payload', async () => {
    await request(httpServer)
      .post('/collection/auto-generate')
      .send({
        centerId: '00000000-0000-4000-8000-000000000001',
        date: '2026-09-05',
      })
      .expect(201, []);
  });

  it('rejects invalid payment bodies and invalid collection UUIDs', async () => {
    await request(httpServer)
      .patch('/collection/00000000-0000-4000-8000-000000000001/payment')
      .send({ paymentAmount: 1, actorId: 'spoofed' })
      .expect(400);

    await request(httpServer)
      .patch('/collection/not-a-uuid/payment')
      .send({ paymentAmount: 1 })
      .expect(400);

    await request(httpServer)
      .post('/collection/auto-generate')
      .send({ centerId: 'not-a-uuid', date: 'not-a-date' })
      .expect(400);
  });
});
