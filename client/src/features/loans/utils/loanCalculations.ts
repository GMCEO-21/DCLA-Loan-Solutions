import type { LoanCalculation } from "../types";

// Business logic for interest rates
export const getInterestRate = (
  termWeeks: number,
  monthlyInterestRate?: number,
): number => {
  if (termWeeks === 4) return 0.1;
  if (termWeeks === 8) return 0.2;
  if (termWeeks === 12) return 0.3;
  return (Number(monthlyInterestRate || 0) * 6) / 100;
};

// Savings is now manually provided at loan creation; keep function only if needed elsewhere
export const getSavingsRequired = (): number => {
  return 0;
};

// Calculate all loan details
export const calculateLoanDetails = (
  principalAmount: number,
  termWeeks: 4 | 8 | 12 | 24,
  monthlyInterestRate?: number,
): LoanCalculation => {
  const interestRate = getInterestRate(termWeeks, monthlyInterestRate);
  const totalInterest = principalAmount * interestRate;
  const totalAmount = principalAmount + totalInterest;
   // Compute base weekly payment
  const baseWeeklyPayment = totalAmount / termWeeks;
  // Round down to the nearest tens
  const roundedWeeklyPayment = Math.floor(baseWeeklyPayment / 10) * 10;
  // If term is 12 weeks, add 10 to the rounded weekly payment
  const weeklyPaymentAmount =
    termWeeks === 12 || termWeeks === 24
      ? roundedWeeklyPayment + 10
      : roundedWeeklyPayment;
  const savings = 0;

  return {
    principalAmount,
    termWeeks,
    interestRate,
    totalInterest,
    totalAmount,
    weeklyPaymentAmount,
    savings,
  };
};

// Format currency
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount);
};

// Format percentage
export const formatPercentage = (value: number): string => {
  return `${(value * 100).toFixed(0)}%`;
};
