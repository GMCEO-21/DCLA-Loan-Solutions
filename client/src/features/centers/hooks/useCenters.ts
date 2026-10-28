import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { CentersAPI } from "../api";
import type { Center, CenterFormData, PaginatedCenters } from "../types";
import { getApiErrorMessage } from "@utils/apiError";

export const centerKeys = {
  all: ["centers"] as const,
  list: (page: number, limit: number, search: string) =>
    [...centerKeys.all, "list", page, limit, search] as const,
  options: ["centers", "options"] as const,
};

const EMPTY_CENTERS: Center[] = [];

export function useCenters() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimitState] = useState(3);
  const [search, setSearchState] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useQuery<PaginatedCenters | Center[], Error>(
    centerKeys.list(page, limit, debouncedSearch),
    ({ signal }) =>
      CentersAPI.getAll(
        { page, limit, search: debouncedSearch || undefined },
        signal,
      ),
    { keepPreviousData: true, staleTime: 30_000 },
  );

  const invalidateCenters = useCallback(
    () => queryClient.invalidateQueries(centerKeys.all),
    [queryClient],
  );
  const createMutation = useMutation(
    (data: CenterFormData) => CentersAPI.create(data),
    { onSuccess: invalidateCenters },
  );
  const updateMutation = useMutation(
    ({ id, data }: { id: string; data: CenterFormData }) =>
      CentersAPI.update(id, data),
    { onSuccess: invalidateCenters },
  );
  const deleteMutation = useMutation((id: string) => CentersAPI.remove(id), {
    onSuccess: invalidateCenters,
  });

  const data = query.data;
  const centers = Array.isArray(data) ? data : (data?.items ?? EMPTY_CENTERS);
  const total = Array.isArray(data) ? data.length : (data?.total ?? 0);
  const mutationError =
    createMutation.error ?? updateMutation.error ?? deleteMutation.error;

  const setSearch = useCallback((value: string) => {
    setPage(1);
    setSearchState(value);
  }, []);
  const setLimit = useCallback((value: number) => {
    setPage(1);
    setLimitState(value);
  }, []);

  return {
    centers,
    total,
    page,
    limit,
    setPage,
    setLimit,
    search,
    setSearch,
    loading:
      query.isLoading ||
      query.isFetching ||
      createMutation.isLoading ||
      updateMutation.isLoading ||
      deleteMutation.isLoading,
    error:
      mutationError || query.error
        ? getApiErrorMessage(mutationError ?? query.error)
        : null,
    createCenter: createMutation.mutateAsync,
    updateCenter: (id: string, data: CenterFormData) =>
      updateMutation.mutateAsync({ id, data }),
    deleteCenter: deleteMutation.mutateAsync,
    refetch: async () => {
      await query.refetch();
    },
  };
}
