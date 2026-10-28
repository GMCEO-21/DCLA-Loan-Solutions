import Decimal from 'decimal.js';

export type MoneyInput = Decimal.Value | null | undefined;

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

export function decimal(value: MoneyInput): Decimal {
  return new Decimal(value ?? 0);
}

export function money(value: MoneyInput): Decimal {
  return decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function moneyNumber(value: MoneyInput): number {
  return Number(money(value).toFixed(2));
}

export function moneyString(value: MoneyInput): string {
  return money(value).toFixed(2);
}
