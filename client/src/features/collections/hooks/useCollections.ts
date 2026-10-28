import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import collectionsService from "../api.ts";
import type { DailyCollectionGroup, CollectionFormData } from "../types.ts";
import { getApiErrorMessage } from "@utils/apiError";
import { getManilaBusinessDate } from "@utils/dateTime";

export type CollectionsTab = 0 | 1;

export const collectionKeys = {
  all: ["collections"] as const,
  daily: (date: string) => ["collections", "daily", date] as const,
  grouped: (date: string) => ["collections", "grouped", date] as const,
};

const EMPTY_GROUPS: DailyCollectionGroup[] = [];

export function useCollections(activeTab: CollectionsTab = 0) {
  const queryClient = useQueryClient();
  const [dailyDate, setDailyDate] = useState<string>(getManilaBusinessDate);
  const [allDate, setAllDate] = useState<string>(getManilaBusinessDate);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const dailyQuery = useQuery<DailyCollectionGroup[], Error>(
    collectionKeys.daily(dailyDate),
    ({ signal }) => collectionsService.getTodayCollections(dailyDate, signal),
    {
      enabled: activeTab === 0,
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  );
  const allQuery = useQuery<DailyCollectionGroup[], Error>(
    collectionKeys.grouped(allDate),
    ({ signal }) => collectionsService.getAllCollectionGroups(allDate, signal),
    { enabled: activeTab === 1, keepPreviousData: true, staleTime: 15_000 },
  );

  const updateMutation = useMutation(
    ({ id, data }: { id: string; data: Partial<CollectionFormData> }) =>
      collectionsService.updateCollection(id, data),
    {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(collectionKeys.daily(dailyDate)),
          queryClient.invalidateQueries(collectionKeys.grouped(allDate)),
        ]);
      },
    },
  );

  const validatedSearch = useMemo(() => {
    const trimmed = debouncedSearch.trim();
    return trimmed.length >= 2 ? trimmed.toLowerCase() : undefined;
  }, [debouncedSearch]);
  const filterGroups = useCallback(
    (groups: DailyCollectionGroup[]) =>
      validatedSearch
        ? groups.filter((group) =>
            group.centerName.toLowerCase().includes(validatedSearch),
          )
        : groups,
    [validatedSearch],
  );

  const unfilteredDaily = dailyQuery.data ?? EMPTY_GROUPS;
  const unfilteredAll = allQuery.data ?? EMPTY_GROUPS;
  const dailyHasData = dailyQuery.isSuccess && dailyQuery.data !== undefined;
  const allHasData = allQuery.isSuccess && allQuery.data !== undefined;
  const dailyCollections = useMemo(
    () => filterGroups(unfilteredDaily),
    [filterGroups, unfilteredDaily],
  );
  const allCollections = useMemo(
    () => filterGroups(unfilteredAll),
    [filterGroups, unfilteredAll],
  );

  const syncDailyDate = useCallback(() => {
    const currentDate = getManilaBusinessDate();
    if (currentDate === dailyDate) return false;

    setDailyDate(currentDate);
    return true;
  }, [dailyDate]);

  useEffect(() => {
    const handleWindowFocus = () => {
      const dateChanged = syncDailyDate();
      if (!dateChanged && activeTab === 0 && dailyQuery.isStale) {
        void dailyQuery.refetch();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, [activeTab, dailyQuery.isStale, dailyQuery.refetch, syncDailyDate]);

  return {
    dailyCollections,
    allCollections,
    dailyHasData,
    allHasData,
    totalDailyCenters: unfilteredDaily.length,
    totalAllCenters: unfilteredAll.length,
    totalAllCollectionItems: unfilteredAll.reduce(
      (sum, group) => sum + (group.collections?.length ?? 0),
      0,
    ),
    search,
    setSearch,
    dailyDate,
    allDate,
    setAllDate,
    syncDailyDate,
    loading:
      (activeTab === 0 ? dailyQuery.isFetching : allQuery.isFetching) ||
      updateMutation.isLoading,
    loadingDaily: dailyQuery.isFetching,
    loadingAll: allQuery.isFetching,
    error: updateMutation.error
      ? getApiErrorMessage(updateMutation.error)
      : activeTab === 0 && dailyQuery.error
        ? getApiErrorMessage(dailyQuery.error)
        : activeTab === 1 && allQuery.error
          ? getApiErrorMessage(allQuery.error)
          : null,
    errors: {
      daily: dailyQuery.error ? getApiErrorMessage(dailyQuery.error) : null,
      all: allQuery.error ? getApiErrorMessage(allQuery.error) : null,
      update: updateMutation.error
        ? getApiErrorMessage(updateMutation.error)
        : null,
    },
    updateCollection: (id: string, data: Partial<CollectionFormData>) =>
      updateMutation.mutateAsync({ id, data }),
    refetchDaily: async () => {
      if (syncDailyDate()) return;
      await dailyQuery.refetch();
    },
    refetchAll: async () => {
      await allQuery.refetch();
    },
  };
}
