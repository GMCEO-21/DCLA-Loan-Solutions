import { LoanRepaymentSchedule } from './entities/loan-repayment-schedule.entity';

export interface RealizedAllocationSplit {
  principalPortion: number;
  interestPortion: number;
}

const roundCurrency = (value: number): number => Number(value.toFixed(2));

export const getRealizedAllocationSplit = (
  schedule: Pick<LoanRepaymentSchedule, 'amountPaid' | 'interestDue' | 'principalDue'>,
  appliedAmount: number,
): RealizedAllocationSplit => {
  const paidBefore = roundCurrency(Number(schedule.amountPaid || 0));
  const applied = roundCurrency(Math.max(0, Number(appliedAmount || 0)));
  const interestDue = roundCurrency(Number(schedule.interestDue || 0));
  const principalDue = roundCurrency(Number(schedule.principalDue || 0));

  const priorInterestPaid = roundCurrency(Math.min(paidBefore, interestDue));
  const priorPrincipalPaid = roundCurrency(
    Math.min(principalDue, Math.max(0, paidBefore - interestDue)),
  );

  const paidAfter = roundCurrency(paidBefore + applied);
  const nextInterestPaid = roundCurrency(Math.min(paidAfter, interestDue));
  const nextPrincipalPaid = roundCurrency(
    Math.min(principalDue, Math.max(0, paidAfter - interestDue)),
  );

  return {
    interestPortion: roundCurrency(nextInterestPaid - priorInterestPaid),
    principalPortion: roundCurrency(nextPrincipalPaid - priorPrincipalPaid),
  };
};
