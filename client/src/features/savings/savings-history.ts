import type { SavingsEventType } from "./types";

export const SAVINGS_EVENT_LABELS: Record<SavingsEventType, string> = {
  opening_balance: "Opening Balance",
  loan_origination_contribution: "Loan Savings Contribution",
  reloan_contribution: "Reloan Savings Contribution",
  manual_deposit: "Deposit",
  manual_withdrawal: "Withdrawal",
  repayment_debit: "Repayment Using Savings",
  repayment_reversal_credit: "Repayment Reversal",
};

const decimalPattern = /^(-?)(\d+)(?:\.(\d+))?$/;

export function formatSavingsMoney(value: string, showPositiveSign = false) {
  const match = decimalPattern.exec(value);
  if (!match) return value;

  const [, negative, integer, fraction = ""] = match;
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimals = fraction.padEnd(2, "0").slice(0, 2);
  const sign = negative ? "-" : showPositiveSign && value !== "0.00" ? "+" : "";

  return `${sign}₱${grouped}.${decimals}`;
}

export function formatSavingsBusinessDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(
    new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    ),
  );
}
