import { useQuery } from "react-query";
import type { ProjectedIncomeSummary } from "../types";
import { portfolioService } from "../api";
import { getApiErrorMessage } from "@utils/apiError";
import { portfolioKeys } from "./usePortfolio";

export function useProjectedIncome() {
  const query = useQuery<ProjectedIncomeSummary, Error>(
    portfolioKeys.projected,
    ({ signal }) => portfolioService.getProjectedIncomeData(signal),
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
