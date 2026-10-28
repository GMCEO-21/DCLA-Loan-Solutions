import { useQuery } from "react-query";
import type { PortfolioSummary } from "../types";
import { portfolioService } from "../api";
import { getApiErrorMessage } from "@utils/apiError";

export const portfolioKeys = {
  all: ["portfolio"] as const,
  overview: ["portfolio", "overview"] as const,
  projected: ["portfolio", "projected"] as const,
  expected: (granularity: string, month?: number, year?: number) =>
    ["portfolio", "expected", granularity, month ?? 0, year ?? 0] as const,
  actual: (granularity: string, month?: number, year?: number) =>
    ["portfolio", "actual", granularity, month ?? 0, year ?? 0] as const,
};

export function usePortfolio() {
  const query = useQuery<PortfolioSummary, Error>(
    portfolioKeys.overview,
    ({ signal }) => portfolioService.getPortfolioData(signal),
    { staleTime: 30_000 },
  );

  return {
    data: query.data ?? null,
    loading: query.isLoading || query.isFetching,
    error: query.error ? getApiErrorMessage(query.error) : null,
    refetch: async () => {
      await query.refetch();
    },
  };
}
