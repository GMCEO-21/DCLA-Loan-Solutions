import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembersAPI } from "../api";
import type { Member, PaginatedMembers } from "../types";
import { useMembers } from "./useMember";

vi.mock("../api", () => ({
  MembersAPI: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const response = (member?: Member): PaginatedMembers => ({
  items: member ? [member] : [],
  total: member ? 1 : 0,
  page: 1,
  limit: 4,
  totalPages: 1,
});

const member = (name: string) =>
  ({
    id: name,
    firstName: name,
    lastName: "Member",
    middleName: "",
    contactNumber: "09171234567",
    address: "Davao City",
    birthDate: new Date("1990-01-01"),
  }) as Member;

describe("useMembers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("makes one initial request and prevents an obsolete filter response from winning", async () => {
    const resolvers = new Map<string, (value: PaginatedMembers) => void>();
    vi.mocked(MembersAPI.getAll).mockImplementation(
      (query) =>
        new Promise((resolve) => {
          resolvers.set(query?.search ?? "initial", resolve);
        }),
    );

    const { result, rerender } = renderHook(
      ({ search }: { search?: string }) => useMembers({ search }),
      {
        initialProps: { search: undefined as string | undefined },
        wrapper: createWrapper(),
      },
    );
    await waitFor(() => expect(MembersAPI.getAll).toHaveBeenCalledTimes(1));
    expect(MembersAPI.getAll).toHaveBeenLastCalledWith(
      { page: 1, limit: 4, search: undefined },
      expect.any(AbortSignal),
    );

    rerender({ search: "newest" });
    await waitFor(() => expect(resolvers.has("newest")).toBe(true));
    await act(async () =>
      resolvers.get("newest")?.(response(member("Newest"))),
    );
    await waitFor(() =>
      expect(result.current.members[0]?.firstName).toBe("Newest"),
    );

    await act(async () =>
      resolvers.get("initial")?.(response(member("Obsolete"))),
    );
    expect(result.current.members[0]?.firstName).toBe("Newest");
  });

  it("invalidates the members query after a successful mutation", async () => {
    vi.mocked(MembersAPI.getAll).mockResolvedValue(response());
    vi.mocked(MembersAPI.remove).mockResolvedValue(undefined);
    const { result } = renderHook(() => useMembers(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.deleteMember("member-1"));
    await waitFor(() => expect(MembersAPI.getAll).toHaveBeenCalledTimes(2));
  });
});
