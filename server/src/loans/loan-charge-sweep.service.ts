import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { getFinancialBusinessDate } from '../common/financial-business-date';
import {
  LoanChargeSweepResult,
  LoanChargesService,
} from './loan-charges.service';
import { LOAN_CHARGE_BATCH_SIZE } from './loan-charge-policy.constants';

const LOAN_CHARGE_SWEEP_ADVISORY_LOCK = 1_789_344_000;

export interface LockedLoanChargeSweepResult {
  acquired: boolean;
  result: LoanChargeSweepResult | null;
}

@Injectable()
export class LoanChargeSweepService {
  private readonly logger = new Logger(LoanChargeSweepService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly loanChargesService: LoanChargesService,
  ) {}

  async run(
    asOfDate = getFinancialBusinessDate(),
    source: 'scheduler' | 'manual' = 'manual',
    actorId?: string,
  ): Promise<LockedLoanChargeSweepResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let acquired = false;
    try {
      const rows = (await queryRunner.query(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [LOAN_CHARGE_SWEEP_ADVISORY_LOCK],
      )) as Array<{ acquired: boolean }>;
      acquired = Boolean(rows[0]?.acquired);
      if (!acquired) {
        this.logger.warn(`Charge sweep skipped; lock held source=${source}`);
        return { acquired: false, result: null };
      }

      this.logger.log(
        `Charge sweep started source=${source} asOf=${asOfDate} actor=${actorId ?? 'system'}`,
      );
      const result =
        await this.loanChargesService.postDueChargesForEligibleLoans(
          asOfDate,
          this.numberConfig(LOAN_CHARGE_BATCH_SIZE, 100),
        );
      this.logger.log(
        `Charge sweep completed source=${source} scanned=${result.scannedCount} processed=${result.processedCount} charges=${result.chargeCount} failed=${result.failedCount}`,
      );
      return { acquired: true, result };
    } finally {
      if (acquired) {
        await queryRunner.query('SELECT pg_advisory_unlock($1)', [
          LOAN_CHARGE_SWEEP_ADVISORY_LOCK,
        ]);
      }
      await queryRunner.release();
    }
  }

  private numberConfig(key: string, fallback: number): number {
    const value = Number(this.config.get<string>(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }
}
