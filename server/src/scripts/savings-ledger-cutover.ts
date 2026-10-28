import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { Collection } from '../collections/entities/collection.entity';
import { LoanWaiver } from '../loans/entities/loan-waiver.entity';
import { Loan } from '../loans/loan.entity';
import { LoansService } from '../loans/loans.service';
import { LoanChargeLedger } from '../loans/entities/loan-charge-ledger.entity';
import { LoanChargePolicyService } from '../loans/loan-charge-policy.service';
import { LoanChargesService } from '../loans/loan-charges.service';
import { Member } from '../members/entities/member.entity';
import { LoanRepaymentSchedule } from '../repayments/entities/loan-repayment-schedule.entity';
import {
  SAVINGS_OPENING_CONFIRMATION,
  SavingsLedgerCutoverBlockedError,
  SavingsLedgerCutoverResult,
  SavingsLedgerCutoverService,
} from '../savings/savings-ledger-cutover.service';
import { Savings } from '../savings/savings.entity';

export interface SavingsLedgerCutoverCommandOptions {
  apply: boolean;
}

export function parseSavingsLedgerCutoverArgs(
  args: string[],
): SavingsLedgerCutoverCommandOptions {
  const apply = args.includes('--apply');
  const dryRun = args.includes('--dry-run');
  const confirmation = args.find((arg) => arg.startsWith('--confirm='));
  const supported = args.every(
    (arg) =>
      arg === '--apply' || arg === '--dry-run' || arg.startsWith('--confirm='),
  );

  if (!supported) {
    throw new Error('Unsupported cutover argument.');
  }
  if (apply && dryRun) {
    throw new Error('Choose either --dry-run or --apply, not both.');
  }
  if (apply && confirmation !== `--confirm=${SAVINGS_OPENING_CONFIRMATION}`) {
    throw new Error(`Apply requires --confirm=${SAVINGS_OPENING_CONFIRMATION}`);
  }
  if (!apply && confirmation) {
    throw new Error('--confirm is valid only with --apply.');
  }

  return { apply };
}

export async function executeSavingsLedgerCutoverCommand(
  service: SavingsLedgerCutoverService,
  args: string[],
  at?: Date,
): Promise<SavingsLedgerCutoverResult> {
  const options = parseSavingsLedgerCutoverArgs(args);
  return service.run({ apply: options.apply, at });
}

async function bootstrap() {
  const { AppDataSource } = await import('../data-source');

  try {
    await AppDataSource.initialize();
    const policyService = new LoanChargePolicyService(
      new ConfigService(process.env),
    );
    const loanChargesService = new LoanChargesService(
      AppDataSource.getRepository(Loan),
      AppDataSource.getRepository(LoanChargeLedger),
      AppDataSource.getRepository(LoanRepaymentSchedule),
      AppDataSource.getRepository(LoanWaiver),
      policyService,
    );
    const loansService = new LoansService(
      AppDataSource.getRepository(Loan),
      AppDataSource.getRepository(Member),
      AppDataSource.getRepository(Collection),
      AppDataSource.getRepository(Savings),
      AppDataSource.getRepository(LoanRepaymentSchedule),
      AppDataSource.getRepository(LoanWaiver),
      policyService,
      loanChargesService,
    );
    const service = new SavingsLedgerCutoverService(
      AppDataSource,
      AppDataSource.getRepository(Member),
      AppDataSource.getRepository(Savings),
      loansService,
    );
    const result = await executeSavingsLedgerCutoverCommand(
      service,
      process.argv.slice(2),
    );
    console.log(JSON.stringify(result, null, 2));
    if (result.failed > 0) process.exitCode = 1;
  } catch (error) {
    if (error instanceof SavingsLedgerCutoverBlockedError) {
      console.error(error.message);
      console.error(JSON.stringify(error.preflight, null, 2));
    } else {
      console.error(
        error instanceof Error
          ? error.message
          : 'Savings ledger cutover command failed.',
      );
    }
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

if (require.main === module) {
  void bootstrap();
}
