import { useCallback } from "react";
import { useQuery } from "react-query";
import { smsNotificationsApi } from "@features/notifications/api";
import type { SmsCreditsResponse } from "@features/notifications/types";

export const smsCreditsQueryKey = ["sms-credits"] as const;

export function useSmsCredits() {
  const query = useQuery<SmsCreditsResponse, Error>(
    smsCreditsQueryKey,
    ({ signal }) => smsNotificationsApi.getCredits(signal),
    {
      staleTime: 2 * 60_000,
      cacheTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: false,
    },
  );

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    credits: query.data?.credits,
    loading: query.isLoading || query.isFetching,
    error: query.isError,
    refetch,
  };
}
