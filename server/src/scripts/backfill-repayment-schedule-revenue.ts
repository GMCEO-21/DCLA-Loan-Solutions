import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { Loan } from '../loans/loan.entity';
import { LoanRepaymentSchedule } from '../repayments/entities/loan-repayment-schedule.entity';
import { buildLoanRepaymentBreakdown } from '../repayments/loan-repayment-schedule.utils';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const progressEvery = 25;

  await AppDataSource.initialize();

  const loanRepository = AppDataSource.getRepository(Loan);
  const scheduleRepository = AppDataSource.getRepository(LoanRepaymentSchedule);

  const [loans, schedules] = await Promise.all([
    loanRepository.find(),
    scheduleRepository.find({
      order: {
        weekNumber: 'ASC',
      },
    }),
  ]);

  const schedulesByLoan = new Map<string, LoanRepaymentSchedule[]>();

  for (const schedule of schedules) {
    const rows = schedulesByLoan.get(schedule.loanId) ?? [];
    rows.push(schedule);
    schedulesByLoan.set(schedule.loanId, rows);
  }

  let updatedRows = 0;
  let unchangedRows = 0;
  let skippedLoans = 0;
  let mismatchedLoans = 0;
  let processedLoans = 0;
  let successfulLoans = 0;

  const logProgress = (force = false) => {
    if (!force && processedLoans % progressEvery !== 0) {
      return;
    }

    console.log(
      `[progress] ${processedLoans}/${loans.length} loans processed | successful=${successfulLoans} | updatedRows=${updatedRows} | unchangedRows=${unchangedRows} | skippedLoans=${skippedLoans} | mismatchedLoans=${mismatchedLoans}`,
    );
  };

  for (const loan of loans) {
    processedLoans += 1;
    const loanSchedules = schedulesByLoan.get(loan.id) ?? [];

    if (loanSchedules.length === 0) {
      skippedLoans += 1;
      logProgress();
      continue;
    }

    const breakdown = buildLoanRepaymentBreakdown(loan);

    if (breakdown.length !== loanSchedules.length) {
      mismatchedLoans += 1;
      logProgress();
      continue;
    }

    successfulLoans += 1;

    for (const schedule of loanSchedules) {
      const row = breakdown[schedule.weekNumber - 1];
      if (!row) {
        continue;
      }

      const nextPrincipalDue = Number(row.principalDue);
      const nextInterestDue = Number(
        (Number(schedule.amountDue || 0) - nextPrincipalDue).toFixed(2),
      );
      const currentPrincipalDue = Number(schedule.principalDue || 0);
      const currentInterestDue = Number(schedule.interestDue || 0);

      if (
        currentPrincipalDue === nextPrincipalDue &&
        currentInterestDue === nextInterestDue
      ) {
        unchangedRows += 1;
        continue;
      }

      if (!dryRun) {
        await scheduleRepository.update(schedule.id, {
          principalDue: nextPrincipalDue,
          interestDue: nextInterestDue,
        });
      }

      updatedRows += 1;
    }

    logProgress();
  }

  logProgress(true);

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? 'dry-run' : 'write',
        loansConsidered: loans.length,
        processedLoans,
        successfulLoans,
        updatedRows,
        unchangedRows,
        skippedLoans,
        mismatchedLoans,
      },
      null,
      2,
    ),
  );

  await AppDataSource.destroy();
}

main().catch(async (error) => {
  console.error('Repayment schedule revenue backfill failed.');
  console.error(error);

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }

  process.exit(1);
});
