import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { MembersAPI } from "../api";
import type {
  Member,
  MemberFormData,
  MembersQuery,
  PaginatedMembers,
} from "../types";
import { getApiErrorMessage } from "@utils/apiError";

export const memberKeys = {
  all: ["members"] as const,
  list: (
    query: Required<Pick<MembersQuery, "page" | "limit">> & MembersQuery,
  ) =>
    [
      ...memberKeys.all,
      "list",
      query.page,
      query.limit,
      query.search ?? "",
      query.centerId ?? "",
    ] as const,
};

const EMPTY_MEMBERS: Member[] = [];

export function useMembers(
  filters: Pick<MembersQuery, "search" | "centerId"> = {},
) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimitState] = useState(4);
  const { search, centerId } = filters;

  const queryParams = useMemo(
    () => ({ page, limit, search, centerId }),
    [centerId, limit, page, search],
  );

  const query = useQuery<PaginatedMembers | Member[], Error>(
    memberKeys.list(queryParams),
    ({ signal }) => MembersAPI.getAll(queryParams, signal),
    { keepPreviousData: true, staleTime: 15_000 },
  );

  const invalidateMembers = useCallback(
    () => queryClient.invalidateQueries(memberKeys.all),
    [queryClient],
  );
  const createMutation = useMutation(
    (data: MemberFormData) => MembersAPI.create(data),
    { onSuccess: invalidateMembers },
  );
  const updateMutation = useMutation(
    ({ id, data }: { id: string; data: MemberFormData }) =>
      MembersAPI.update(id, data),
    { onSuccess: invalidateMembers },
  );
  const deleteMutation = useMutation((id: string) => MembersAPI.remove(id), {
    onSuccess: invalidateMembers,
  });

  const data = query.data;
  const members = Array.isArray(data) ? data : (data?.items ?? EMPTY_MEMBERS);
  const total = Array.isArray(data) ? data.length : (data?.total ?? 0);
  const mutationError =
    createMutation.error ?? updateMutation.error ?? deleteMutation.error;

  const setLimit = useCallback((nextLimit: number) => {
    setLimitState(nextLimit);
    setPage(1);
  }, []);

  return {
    members,
    total,
    page,
    limit,
    setPage,
    setLimit,
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
    createMember: createMutation.mutateAsync,
    updateMember: (id: string, data: MemberFormData) =>
      updateMutation.mutateAsync({ id, data }),
    deleteMember: deleteMutation.mutateAsync,
    refetch: async () => {
      await query.refetch();
    },
  };
}
