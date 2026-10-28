import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { Repayment } from '../repayments/repayment.entity';
import { LoanRepaymentAllocation } from '../repayments/entities/loan-repayment-allocation.entity';
import { LoanRepaymentSchedule } from '../repayments/entities/loan-repayment-schedule.entity';
import { getRealizedAllocationSplit } from '../repayments/loan-repayment-allocation.utils';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const repaymentProgressEvery = 100;
  const scheduleProgressEvery = 100;

  await AppDataSource.initialize();

  const repaymentRepository = AppDataSource.getRepository(Repayment);
  const allocationRepository = AppDataSource.getRepository(LoanRepaymentAllocation);
  const scheduleRepository = AppDataSource.getRepository(LoanRepaymentSchedule);

  const [repayments, schedules, allocations] = await Promise.all([
    repaymentRepository.find(),
    scheduleRepository.find(),
    allocationRepository.find({
      relations: ['schedule'],
      order: {
        createdAt: 'ASC',
      },
    }),
  ]);

  const scheduleMap = new Map(schedules.map((schedule) => [schedule.id, schedule]));
  const allocationsBySchedule = new Map<string, LoanRepaymentAllocation[]>();
  const getLegacyRepaymentDate = (repayment: Repayment): string =>
    (repayment.createdAt ?? new Date()).toISOString().split('T')[0];
  let updatedRepayments = 0;
  let unchangedRepayments = 0;
  let updatedAllocations = 0;
  let unchangedAllocations = 0;
  let processedSchedules = 0;
  let processedRepayments = 0;
  let skippedAllocations = 0;

  for (const repayment of repayments) {
    processedRepayments += 1;

    if (repayment.paymentDate) {
      unchangedRepayments += 1;
    } else {
      const nextPaymentDate = getLegacyRepaymentDate(repayment);
      repayment.paymentDate = nextPaymentDate;

      if (!dryRun) {
        await repaymentRepository.update(repayment.id, {
          paymentDate: nextPaymentDate,
        });
      }

      updatedRepayments += 1;
    }

    if (processedRepayments % repaymentProgressEvery === 0) {
      console.log(
        `[progress] repayments=${processedRepayments}/${repayments.length} | updatedRepayments=${updatedRepayments} | unchangedRepayments=${unchangedRepayments}`,
      );
    }
  }

  for (const allocation of allocations) {
    const rows = allocationsBySchedule.get(allocation.scheduleId) ?? [];
    rows.push(allocation);
    allocationsBySchedule.set(allocation.scheduleId, rows);
  }

  for (const [scheduleId, scheduleAllocations] of allocationsBySchedule.entries()) {
    processedSchedules += 1;
    const schedule = scheduleMap.get(scheduleId);

    if (!schedule) {
      skippedAllocations += scheduleAllocations.length;
      continue;
    }

    scheduleAllocations.sort((left, right) => {
      const leftDate = left.schedule?.dueDate
        ? new Date(`${left.schedule.dueDate}T00:00:00Z`).getTime()
        : undefined;
      const rightDate = right.schedule?.dueDate
        ? new Date(`${right.schedule.dueDate}T00:00:00Z`).getTime()
        : undefined;

      if (leftDate !== rightDate) {
        return (
          (leftDate ?? Number.MAX_SAFE_INTEGER) -
          (rightDate ?? Number.MAX_SAFE_INTEGER)
        );
      }

      return (
        (left.createdAt?.getTime() ?? 0) - (right.createdAt?.getTime() ?? 0)
      );
    });

    let runningPaid = 0;
    for (const allocation of scheduleAllocations) {
      if (!allocation.schedule) {
        skippedAllocations += 1;
        continue;
      }

      const split = getRealizedAllocationSplit(
        {
          amountPaid: runningPaid,
          interestDue: schedule.interestDue,
          principalDue: schedule.principalDue,
        },
        Number(allocation.amountApplied || 0),
      );

      const currentPrincipalPortion = Number(allocation.principalPortion || 0);
      const currentInterestPortion = Number(allocation.interestPortion || 0);

      if (
        currentPrincipalPortion !== split.principalPortion ||
        currentInterestPortion !== split.interestPortion
      ) {
        if (!dryRun) {
          await allocationRepository.update(allocation.id, {
            principalPortion: split.principalPortion,
            interestPortion: split.interestPortion,
          });
        }
        updatedAllocations += 1;
      } else {
        unchangedAllocations += 1;
      }

      runningPaid = Number(
        (runningPaid + Number(allocation.amountApplied || 0)).toFixed(2),
      );
    }

    if (processedSchedules % scheduleProgressEvery === 0) {
      console.log(
        `[progress] schedules=${processedSchedules}/${allocationsBySchedule.size} | updatedAllocations=${updatedAllocations} | unchangedAllocations=${unchangedAllocations} | skippedAllocations=${skippedAllocations}`,
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? 'dry-run' : 'write',
        repaymentsConsidered: repayments.length,
        processedRepayments,
        updatedRepayments,
        unchangedRepayments,
        schedulesConsidered: allocationsBySchedule.size,
        processedSchedules,
        updatedAllocations,
        unchangedAllocations,
        skippedAllocations,
      },
      null,
      2,
    ),
  );

  await AppDataSource.destroy();
}

main().catch(async (error) => {
  console.error('Realized revenue backfill failed.');
  console.error(error);

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }

  process.exit(1);
});
