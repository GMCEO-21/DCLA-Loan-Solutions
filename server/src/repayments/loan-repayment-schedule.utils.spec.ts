import { buildLoanRepaymentBreakdown } from './loan-repayment-schedule.utils';

describe('buildLoanRepaymentBreakdown', () => {
  it('uses the final week to reconcile a 24-week loan total', () => {
    const rows = buildLoanRepaymentBreakdown({
      principalAmount: 10_000,
      totalAmount: 16_000,
      termWeeks: 24,
      weeklyPaymentAmount: 670,
    });

    expect(rows).toHaveLength(24);
    expect(rows.slice(0, 23).every((row) => row.amountDue === 670)).toBe(
      true,
    );
    expect(rows[23].amountDue).toBe(590);
    expect(rows.reduce((sum, row) => sum + row.amountDue, 0)).toBe(16_000);
  });
});
