import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "react-query";
import {
  transactionHistoryQueryKey,
  TransactionsAPI,
  type TransactionHistoryQuery,
} from "../api";
import type {
  TransactionFilterType,
  TransactionHistoryItem,
  TransactionHistoryResponse,
} from "../types";

type UseTransactionHistoryReturn = {
  transactions: TransactionHistoryItem[];
  loading: boolean;
  error: string | null;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  filters: TransactionFiltersState;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  updateFilters: (changes: Partial<TransactionFiltersState>) => void;
  refresh: () => Promise<void>;
};

export type TransactionFiltersState = {
  search: string;
  type: TransactionFilterType | "all";
  startDate: string;
  endDate: string;
};

const DEFAULT_FILTERS: TransactionFiltersState = {
  search: "",
  type: "all",
  startDate: "",
  endDate: "",
};

const EMPTY_TRANSACTIONS: TransactionHistoryItem[] = [];

export function useTransactionHistory(
  initialLimit = 25,
): UseTransactionHistoryReturn {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [filters, setFilters] =
    useState<TransactionFiltersState>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(filters.search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const queryParams = useMemo((): TransactionHistoryQuery => {
    const query: TransactionHistoryQuery = {
      page,
      limit,
    };

    if (filters.type && filters.type !== "all") {
      query.type = filters.type;
    }
    if (filters.startDate) {
      query.startDate = filters.startDate;
    }
    if (filters.endDate) {
      query.endDate = filters.endDate;
    }
    if (debouncedSearch) {
      query.search = debouncedSearch;
    }

    return query;
  }, [
    page,
    limit,
    filters.type,
    filters.startDate,
    filters.endDate,
    debouncedSearch,
  ]);

  const query = useQuery<TransactionHistoryResponse, Error>(
    transactionHistoryQueryKey(queryParams),
    ({ signal }) => TransactionsAPI.getHistory(queryParams, signal),
    {
      keepPreviousData: true,
      staleTime: 45_000,
    },
  );

  const updateFilters = useCallback(
    (changes: Partial<TransactionFiltersState>) => {
      setFilters((prev) => ({ ...prev, ...changes }));
      if (
        changes.type !== undefined ||
        changes.startDate !== undefined ||
        changes.endDate !== undefined
      ) {
        setPage(1);
      }
    },
    [],
  );

  const updateLimit = useCallback((nextLimit: number) => {
    setLimit(nextLimit);
    setPage(1);
  }, []);

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const transactions = query.data?.items ?? EMPTY_TRANSACTIONS;
  const total = query.data?.total ?? 0;
  const totalPages = query.data?.totalPages ?? 1;
  const loading = query.isLoading || query.isFetching;
  const error = query.isError ? "Failed to load transactions" : null;

  return useMemo(
    () => ({
      transactions,
      loading,
      error,
      page,
      limit,
      total,
      totalPages,
      filters,
      setPage,
      setLimit: updateLimit,
      updateFilters,
      refresh,
    }),
    [
      transactions,
      loading,
      error,
      page,
      limit,
      total,
      totalPages,
      filters,
      refresh,
      updateFilters,
      updateLimit,
    ],
  );
}
