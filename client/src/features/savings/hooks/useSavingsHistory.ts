import { useEffect } from "react";
import { useQuery, useQueryClient } from "react-query";
import savingsService from "../api";
import type { SavingsHistoryResponse, SavingsHistoryScope } from "../types";

export const SAVINGS_HISTORY_STALE_TIME = 60_000;

export const savingsHistoryKeys = {
  all: ["savings-history"] as const,
  member: (memberId: string) => ["savings-history", memberId] as const,
  page: (
    memberId: string,
    scope: SavingsHistoryScope,
    page: number,
    limit: number,
  ) => ["savings-history", memberId, scope, page, limit] as const,
};

export function useSavingsHistory(
  memberId: string,
  scope: SavingsHistoryScope,
  page: number,
  limit: number,
  enabled = true,
) {
  const queryClient = useQueryClient();
  const query = useQuery<SavingsHistoryResponse, Error>(
    savingsHistoryKeys.page(memberId, scope, page, limit),
    () => savingsService.getHistory({ memberId, scope, page, limit }),
    {
      enabled: enabled && Boolean(memberId),
      keepPreviousData: true,
      staleTime: SAVINGS_HISTORY_STALE_TIME,
    },
  );

  useEffect(() => {
    const totalPages = query.data?.pagination.totalPages ?? 0;
    if (!enabled || !memberId || page >= totalPages) return;

    void queryClient.prefetchQuery(
      savingsHistoryKeys.page(memberId, scope, page + 1, limit),
      () =>
        savingsService.getHistory({ memberId, scope, page: page + 1, limit }),
      { staleTime: SAVINGS_HISTORY_STALE_TIME },
    );
  }, [enabled, limit, memberId, page, query.data, queryClient, scope]);

  return query;
}
