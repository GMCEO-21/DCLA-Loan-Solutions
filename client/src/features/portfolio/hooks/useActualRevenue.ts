import { useQuery } from "react-query";
import { portfolioService } from "../api";
import type {
  ActualRevenueSummary,
  RevenueDateFilter,
  RevenueGranularity,
} from "../types";
import { getApiErrorMessage } from "@utils/apiError";
import { portfolioKeys } from "./usePortfolio";

export function useActualRevenue(
  granularity: RevenueGranularity,
  filter?: RevenueDateFilter,
) {
  const query = useQuery<ActualRevenueSummary, Error>(
    portfolioKeys.actual(granularity, filter?.month, filter?.year),
    ({ signal }) =>
      portfolioService.getActualRevenueData(granularity, filter, signal),
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
