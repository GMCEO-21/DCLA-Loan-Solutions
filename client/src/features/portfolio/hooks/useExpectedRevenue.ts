import { useQuery } from "react-query";
import { portfolioService } from "../api";
import type {
  ExpectedRevenueSummary,
  RevenueDateFilter,
  RevenueGranularity,
} from "../types";
import { getApiErrorMessage } from "@utils/apiError";
import { portfolioKeys } from "./usePortfolio";

export function useExpectedRevenue(
  granularity: RevenueGranularity,
  filter?: RevenueDateFilter,
) {
  const query = useQuery<ExpectedRevenueSummary, Error>(
    portfolioKeys.expected(granularity, filter?.month, filter?.year),
    ({ signal }) =>
      portfolioService.getExpectedRevenueData(granularity, filter, signal),
    { keepPreviousData: true, staleTime: 30_000 },
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
