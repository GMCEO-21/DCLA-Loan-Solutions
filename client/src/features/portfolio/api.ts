import api from "@utils/api";
import type {
  ActualRevenueSummary,
  ExpectedRevenueSummary,
  PortfolioSummary,
  ProjectedIncomeSummary,
  RevenueDateFilter,
  RevenueGranularity,
} from "./types";

export const portfolioService = {
  // Get portfolio data
  getPortfolioData: async (signal?: AbortSignal): Promise<PortfolioSummary> => {
    const response = await api.get("/portfolio", { signal });
    return response.data;
  },

  // Get projected income data
  getProjectedIncomeData: async (
    signal?: AbortSignal,
  ): Promise<ProjectedIncomeSummary> => {
    const response = await api.get("/portfolio/projected-income", { signal });
    return response.data;
  },

  getExpectedRevenueData: async (
    granularity: RevenueGranularity,
    filter?: RevenueDateFilter,
    signal?: AbortSignal,
  ): Promise<ExpectedRevenueSummary> => {
    const response = await api.get("/portfolio/expected-revenue", {
      params: { granularity, ...filter },
      signal,
    });
    return response.data;
  },

  getActualRevenueData: async (
    granularity: RevenueGranularity,
    filter?: RevenueDateFilter,
    signal?: AbortSignal,
  ): Promise<ActualRevenueSummary> => {
    const response = await api.get("/portfolio/actual-revenue", {
      params: { granularity, ...filter },
      signal,
    });
    return response.data;
  },
};

export default portfolioService;
