import { SavingsEventType } from './savings.entity';

export const SAVINGS_REFERENCE_TYPE = {
  LOAN: 'loan',
  REPAYMENT: 'repayment',
  REPAYMENT_REVERSAL: 'repayment_reversal',
} as const;

export function loanContributionIdempotencyKey(
  loanId: string,
  eventType:
    | SavingsEventType.LOAN_ORIGINATION_CONTRIBUTION
    | SavingsEventType.RELOAN_CONTRIBUTION,
): string {
  const contributionType =
    eventType === SavingsEventType.RELOAN_CONTRIBUTION
      ? 'reloan-contribution'
      : 'origination-contribution';
  return `loan:v1:${loanId}:${contributionType}`;
}

export function repaymentSavingsDebitIdempotencyKey(
  repaymentId: string,
): string {
  return `repayment:v1:${repaymentId}:savings-debit`;
}

export function repaymentSavingsReversalIdempotencyKey(
  reversalRepaymentId: string,
): string {
  return `repayment:v1:${reversalRepaymentId}:savings-reversal-credit`;
}
