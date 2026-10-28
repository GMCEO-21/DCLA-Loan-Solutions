import Decimal from 'decimal.js';
import { decimal, money } from '../common/money';

export const WEEKLY_PENALTY_FIRST_THRESHOLD = new Decimal(1_000);
export const WEEKLY_PENALTY_SECOND_THRESHOLD = new Decimal(2_000);
export const WEEKLY_PENALTY_BELOW_FIRST = new Decimal(50);
export const WEEKLY_PENALTY_BELOW_SECOND = new Decimal(100);
export const WEEKLY_PENALTY_AT_OR_ABOVE_SECOND = new Decimal(200);
export const MATURITY_PENALTY_RATE = new Decimal('0.30');
export const PAST_DUE_MONTHLY_INTEREST_RATE = new Decimal('0.10');
export const PAST_DUE_DAY_DIVISOR = new Decimal(30);

export function calculateWeeklyPenalty(weeklyAmortization: Decimal.Value) {
  const weekly = money(weeklyAmortization);
  if (weekly.lt(WEEKLY_PENALTY_FIRST_THRESHOLD)) {
    return WEEKLY_PENALTY_BELOW_FIRST;
  }
  if (weekly.lt(WEEKLY_PENALTY_SECOND_THRESHOLD)) {
    return WEEKLY_PENALTY_BELOW_SECOND;
  }
  return WEEKLY_PENALTY_AT_OR_ABOVE_SECOND;
}

export function calculateMaturityPenalty(remainingPrincipal: Decimal.Value) {
  return money(decimal(remainingPrincipal).mul(MATURITY_PENALTY_RATE));
}

export function calculatePastDueInterest(
  remainingPrincipal: Decimal.Value,
  overdueDays: number,
) {
  if (!Number.isInteger(overdueDays) || overdueDays < 0) {
    throw new RangeError('overdueDays must be a nonnegative integer');
  }
  return money(
    decimal(remainingPrincipal)
      .mul(PAST_DUE_MONTHLY_INTEREST_RATE)
      .div(PAST_DUE_DAY_DIVISOR)
      .mul(overdueDays),
  );
}

export function calculateChargeOutstanding(
  accrued: Decimal.Value,
  paid: Decimal.Value,
  waived: Decimal.Value,
) {
  return Decimal.max(0, decimal(accrued).sub(paid).sub(waived)).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
}
