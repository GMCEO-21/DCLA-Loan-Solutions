import {
  calculateChargeOutstanding,
  calculateMaturityPenalty,
  calculatePastDueInterest,
  calculateWeeklyPenalty,
} from './loan-charge-calculations';

describe('loan charge calculations', () => {
  it.each([
    ['999.99', '50.00'],
    ['1000', '100.00'],
    ['1999.99', '100.00'],
    ['2000', '200.00'],
  ])('calculates the weekly tier for %s', (weekly, expected) => {
    expect(calculateWeeklyPenalty(weekly).toFixed(2)).toBe(expected);
  });

  it('calculates a one-time 30 percent maturity penalty', () => {
    expect(calculateMaturityPenalty('8321.45').toFixed(2)).toBe('2496.44');
  });

  it('calculates simple daily PDI without compounding', () => {
    expect(calculatePastDueInterest('10000', 1).toFixed(2)).toBe('33.33');
    expect(calculatePastDueInterest('8000', 1).toFixed(2)).toBe('26.67');
    expect(calculatePastDueInterest('10000', 3).toFixed(2)).toBe('100.00');
  });

  it('does not return negative outstanding charges', () => {
    expect(calculateChargeOutstanding('100', '80', '30').toFixed(2)).toBe(
      '0.00',
    );
  });
});
