import { useCallback, useEffect, useRef, useState } from "react";
import { smsNotificationsApi } from "@features/notifications/api";
import type { RecentSmsActivityResult } from "@features/notifications/types";

export function useRecentSmsActivity(limit = 10) {
  const [data, setData] = useState<RecentSmsActivityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError(null);

    try {
      const result = await smsNotificationsApi.getRecent(limit, controller.signal);
      if (!controller.signal.aborted) setData(result);
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load recent SMS activity."
        );
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }, [limit]);

  useEffect(() => {
    void refetch();
    return () => activeRequest.current?.abort();
  }, [refetch]);

  return { data, loading, error, refetch };
}
