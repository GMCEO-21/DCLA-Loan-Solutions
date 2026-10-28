export interface LoanScheduleBreakdownInput {
  principalAmount?: number | string | null;
  totalAmount?: number | string | null;
  interestRate?: number | string | null;
  termWeeks?: number | string | null;
  weeklyPaymentAmount?: number | string | null;
}

export interface LoanScheduleBreakdownRow {
  weekNumber: number;
  amountDue: number;
  principalDue: number;
  interestDue: number;
}

const roundCurrency = (value: number): number => Number(value.toFixed(2));

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getLoanTotalInterest = (
  loan: LoanScheduleBreakdownInput,
): number => {
  const principalAmount = toNumber(loan.principalAmount);
  const totalAmount = toNumber(loan.totalAmount);

  if (totalAmount > 0) {
    return roundCurrency(Math.max(0, totalAmount - principalAmount));
  }

  const interestRate = toNumber(loan.interestRate);
  return roundCurrency(Math.max(0, principalAmount * interestRate));
};

export const buildLoanRepaymentBreakdown = (
  loan: LoanScheduleBreakdownInput,
): LoanScheduleBreakdownRow[] => {
  const termWeeks = Math.max(0, Math.trunc(toNumber(loan.termWeeks)));
  const principalTotal = roundCurrency(Math.max(0, toNumber(loan.principalAmount)));
  const weeklyPaymentAmount = roundCurrency(
    Math.max(0, toNumber(loan.weeklyPaymentAmount)),
  );
  const totalAmount = roundCurrency(Math.max(0, toNumber(loan.totalAmount)));

  if (termWeeks <= 0) {
    return [];
  }

  let remainingPrincipal = principalTotal;

  const rows: LoanScheduleBreakdownRow[] = [];

  for (let i = 0; i < termWeeks; i += 1) {
    const amountDue =
      i === termWeeks - 1
        ? roundCurrency(
            Math.max(0, totalAmount - weeklyPaymentAmount * (termWeeks - 1)),
          )
        : weeklyPaymentAmount;
    const remainingWeeks = termWeeks - i;
    let principalDue =
      remainingWeeks === 1
        ? roundCurrency(remainingPrincipal)
        : roundCurrency(remainingPrincipal / remainingWeeks);

    if (amountDue > 0) {
      principalDue = Math.min(principalDue, amountDue);
    }

    const interestDue =
      amountDue > 0 ? roundCurrency(amountDue - principalDue) : 0;

    rows.push({
      weekNumber: i + 1,
      amountDue,
      principalDue,
      interestDue,
    });

    remainingPrincipal = roundCurrency(remainingPrincipal - principalDue);
  }

  return rows;
};
