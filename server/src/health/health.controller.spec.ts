import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { GLOBAL_PREFIX_EXCLUSIONS } from '../config/http.config';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports process liveness without querying the database', () => {
    const query = jest.fn();
    const dataSource = { query } as unknown as DataSource;
    const controller = new HealthController(dataSource);

    expect(controller.health()).toEqual({ status: 'ok' });
    expect(query).not.toHaveBeenCalled();
  });

  it('reports readiness when the database is available', async () => {
    const query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const dataSource = {
      query,
    } as unknown as DataSource;

    await expect(new HealthController(dataSource).ready()).resolves.toEqual({
      status: 'ok',
    });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns a sanitized 503 when the database is unavailable', async () => {
    const dataSource = {
      query: jest.fn().mockRejectedValue(new Error('database details')),
    } as unknown as DataSource;

    const result = new HealthController(dataSource).ready();
    await expect(result).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(result).rejects.toMatchObject({
      response: { status: 'unavailable' },
      status: 503,
    });
  });

  describe('HTTP routes', () => {
    let app: INestApplication;
    const query = jest.fn();
    const httpServer = () =>
      app.getHttpServer() as Parameters<typeof request>[0];

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [{ provide: DataSource, useValue: { query } }],
      }).compile();
      app = module.createNestApplication();
      app.setGlobalPrefix('api', { exclude: GLOBAL_PREFIX_EXCLUSIONS });
      await app.init();
    });

    afterEach(async () => {
      query.mockReset();
      await app.close();
    });

    it('serves liveness at GET /health', async () => {
      await request(httpServer())
        .get('/health')
        .expect(200)
        .expect({ status: 'ok' });
      expect(query).not.toHaveBeenCalled();
    });

    it('serves database readiness at GET /health/ready', async () => {
      query.mockResolvedValue([{ '?column?': 1 }]);
      await request(httpServer())
        .get('/health/ready')
        .expect(200)
        .expect({ status: 'ok' });
    });

    it('returns a sanitized 503 readiness response', async () => {
      query.mockRejectedValue(new Error('private database detail'));
      const response = await request(httpServer())
        .get('/health/ready')
        .expect(503);

      expect(response.body).toEqual({ status: 'unavailable' });
      expect(response.text).not.toContain('private database detail');
    });
  });
});
