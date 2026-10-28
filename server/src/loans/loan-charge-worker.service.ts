import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LOAN_CHARGE_POLL_INTERVAL_MS,
  LOAN_CHARGE_SCHEDULER_ENABLED,
} from './loan-charge-policy.constants';
import { LoanChargeSweepService } from './loan-charge-sweep.service';

@Injectable()
export class LoanChargeWorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(LoanChargeWorkerService.name);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopping = false;

  constructor(
    private readonly config: ConfigService,
    private readonly sweepService: LoanChargeSweepService,
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
    await this.sweepService.run(undefined, 'scheduler');
  }

  private schedule(delay: number): void {
    if (this.stopping) return;
    this.timer = setTimeout(() => void this.runScheduledPoll(), delay);
    this.timer.unref?.();
  }

  private async runScheduledPoll(): Promise<void> {
    try {
      await this.pollOnce();
    } catch (error) {
      this.logger.error(
        'Loan charge worker poll failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.schedule(this.pollInterval());
    }
  }

  private isEnabled(): boolean {
    return this.config.get<string>(LOAN_CHARGE_SCHEDULER_ENABLED) === 'true';
  }

  private pollInterval(): number {
    const value = Number(this.config.get<string>(LOAN_CHARGE_POLL_INTERVAL_MS));
    return Number.isInteger(value) && value > 0 ? value : 60 * 60 * 1000;
  }
}
