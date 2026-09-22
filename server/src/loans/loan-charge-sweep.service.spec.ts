import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { LoanChargeSweepService } from './loan-charge-sweep.service';
import { LoanChargesService } from './loan-charges.service';

describe('LoanChargeSweepService', () => {
  function createHarness(acquired: boolean) {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ acquired }])
      .mockResolvedValueOnce([{ pg_advisory_unlock: true }]);
    const queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      query,
      release: jest.fn().mockResolvedValue(undefined),
    };
    const dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as unknown as DataSource;
    const config = {
      get: jest.fn().mockReturnValue('25'),
    } as unknown as ConfigService;
    const result = {
      asOfDate: '2026-10-10',
      scannedCount: 2,
      processedCount: 2,
      chargeCount: 1,
      skippedPendingCount: 0,
      failedCount: 0,
      failures: [],
    };
    const postDueChargesForEligibleLoans = jest.fn().mockResolvedValue(result);
    const chargeService = {
      postDueChargesForEligibleLoans,
    } as unknown as LoanChargesService;
    return {
      service: new LoanChargeSweepService(dataSource, config, chargeService),
      postDueChargesForEligibleLoans,
      query,
      release: queryRunner.release,
      result,
    };
  }

  it('runs with a PostgreSQL advisory lock and releases it', async () => {
    const { service, postDueChargesForEligibleLoans, query, release, result } =
      createHarness(true);

    await expect(
      service.run('2026-10-10', 'manual', 'manager-1'),
    ).resolves.toEqual({ acquired: true, result });
    expect(postDueChargesForEligibleLoans).toHaveBeenCalledWith(
      '2026-10-10',
      25,
    );
    expect(query).toHaveBeenLastCalledWith('SELECT pg_advisory_unlock($1)', [
      1_789_344_000,
    ]);
    expect(release).toHaveBeenCalled();
  });

  it('does not process when another instance owns the lock', async () => {
    const { service, postDueChargesForEligibleLoans } = createHarness(false);

    await expect(service.run('2026-10-10')).resolves.toEqual({
      acquired: false,
      result: null,
    });
    expect(postDueChargesForEligibleLoans).not.toHaveBeenCalled();
  });
});
