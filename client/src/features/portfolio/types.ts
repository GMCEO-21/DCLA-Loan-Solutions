export interface PortfolioData {
  no: number;
  centerName: string;
  amountDisbursed: number;
  outstandingCollection: number;
}

export interface PortfolioSummary {
  totalAmountDisbursed: number;
  totalOutstandingCollection: number;
  centers: PortfolioData[];
}

export interface ProjectedIncomeData {
  no: number;
  centerName: string;
  outstandingBalance: number;
  interestIncome: number;
}

export interface ProjectedIncomeSummary {
  totalOutstandingBalance: number;
  totalInterestIncome: number;
  centers: ProjectedIncomeData[];
}

export type RevenueGranularity = "weekly" | "monthly";

export interface RevenueDateFilter {
  month: number;
  year: number;
}

export interface RevenueMonthOption {
  month: number;
  year: number;
  label: string;
}

export interface ExpectedRevenuePeriodData {
  periodKey: string;
  periodLabel: string;
  expectedInterest: number;
  serviceCharge: number;
  notarialFee: number;
  totalRevenue: number;
}

export interface ExpectedRevenueSummary {
  granularity: RevenueGranularity;
  availableMonths: RevenueMonthOption[];
  totalExpectedInterest: number;
  totalServiceCharge: number;
  totalNotarialFee: number;
  totalRevenue: number;
  periods: ExpectedRevenuePeriodData[];
}

export interface ActualRevenuePeriodData {
  periodKey: string;
  periodLabel: string;
  actualCollectedInterest: number;
  serviceCharge: number;
  notarialFee: number;
  totalRevenue: number;
}

export interface ActualRevenueSummary {
  granularity: RevenueGranularity;
  availableMonths: RevenueMonthOption[];
  totalActualCollectedInterest: number;
  totalServiceCharge: number;
  totalNotarialFee: number;
  totalRevenue: number;
  periods: ActualRevenuePeriodData[];
}
