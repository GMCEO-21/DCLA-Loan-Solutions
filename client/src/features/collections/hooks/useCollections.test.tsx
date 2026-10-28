import { act, renderHook, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import collectionsService from "../api";
import {
  collectionKeys,
  useCollections,
  type CollectionsTab,
} from "./useCollections";
import type { DailyCollectionGroup } from "../types";

const getManilaBusinessDateMock = vi.hoisted(() => vi.fn());

vi.mock("../api", () => ({
  default: {
    getTodayCollections: vi.fn(),
    getAllCollectionGroups: vi.fn(),
    updateCollection: vi.fn(),
  },
}));

vi.mock("@utils/dateTime", () => ({
  getManilaBusinessDate: getManilaBusinessDateMock,
}));

function forbiddenError() {
  return new AxiosError("forbidden", undefined, undefined, undefined, {
    status: 403,
    statusText: "Forbidden",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { message: "internal role detail" },
  });
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const group = (
  centerName: string,
  collectionDate: string,
): DailyCollectionGroup => ({
  centerId: centerName,
  centerName,
  collectionDay: "Friday",
  collectionDate,
  totalAmount: 0,
  totalReceived: 0,
  totalMembers: 0,
  pendingCollections: 0,
  collections: [],
});

describe("useCollections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getManilaBusinessDateMock.mockReturnValue("2026-09-07");
    vi.mocked(collectionsService.getTodayCollections).mockResolvedValue([]);
    vi.mocked(collectionsService.getAllCollectionGroups).mockResolvedValue([]);
  });

  it("initializes both query dates from the Manila business date", async () => {
    const { result } = renderHook(() => useCollections(0), {
      wrapper: createWrapper(),
    });

    expect(result.current.dailyDate).toBe("2026-09-07");
    expect(result.current.allDate).toBe("2026-09-07");
    await waitFor(() =>
      expect(collectionsService.getTodayCollections).toHaveBeenCalledWith(
        "2026-09-07",
        expect.any(AbortSignal),
      ),
    );
  });

  it("preserves the established collection query key shapes", () => {
    expect(collectionKeys.daily("2026-09-07")).toEqual([
      "collections",
      "daily",
      "2026-09-07",
    ]);
    expect(collectionKeys.grouped("2026-09-03")).toEqual([
      "collections",
      "grouped",
      "2026-09-03",
    ]);
  });

  it("fetches only the active tab and preserves its independent error", async () => {
    vi.mocked(collectionsService.getTodayCollections).mockRejectedValue(
      forbiddenError(),
    );

    const { result } = renderHook(() => useCollections(0), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.errors.daily).toContain("permission");
    expect(result.current.errors.all).toBeNull();
    expect(result.current.dailyHasData).toBe(false);
    expect(result.current.allHasData).toBe(false);
    expect(collectionsService.getTodayCollections).toHaveBeenCalledTimes(1);
    expect(collectionsService.getAllCollectionGroups).not.toHaveBeenCalled();
  });

  it("loads the second tab only after it becomes active", async () => {
    const { result, rerender } = renderHook(
      ({ activeTab }: { activeTab: CollectionsTab }) =>
        useCollections(activeTab),
      {
        initialProps: { activeTab: 0 as CollectionsTab },
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => expect(result.current.loadingDaily).toBe(false));
    expect(result.current.dailyHasData).toBe(true);
    expect(result.current.dailyCollections).toHaveLength(0);
    expect(collectionsService.getAllCollectionGroups).not.toHaveBeenCalled();

    rerender({ activeTab: 1 });
    await waitFor(() => expect(result.current.loadingAll).toBe(false));
    expect(result.current.allHasData).toBe(true);
    expect(collectionsService.getTodayCollections).toHaveBeenCalledTimes(1);
    expect(collectionsService.getAllCollectionGroups).toHaveBeenCalledTimes(1);
  });

  it("keeps the newest dated response when an older request finishes later", async () => {
    const resolvers = new Map<
      string,
      (value: DailyCollectionGroup[]) => void
    >();
    vi.mocked(collectionsService.getAllCollectionGroups).mockImplementation(
      (date) =>
        new Promise((resolve) => {
          resolvers.set(date ?? "", resolve);
        }),
    );

    const { result } = renderHook(() => useCollections(1), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(resolvers.size).toBe(1));
    const oldDate = [...resolvers.keys()][0];

    act(() => result.current.setAllDate("2026-09-10"));
    await waitFor(() => expect(resolvers.has("2026-09-10")).toBe(true));
    await act(async () => {
      resolvers.get("2026-09-10")?.([group("Newest", "2026-09-10")]);
    });
    await waitFor(() =>
      expect(result.current.allCollections[0]?.centerName).toBe("Newest"),
    );

    await act(async () => {
      resolvers.get(oldDate)?.([group("Obsolete", oldDate)]);
    });
    expect(result.current.allCollections[0]?.centerName).toBe("Newest");
    expect(result.current.allDate).toBe("2026-09-10");
  });

  it("switches to the new Manila date on refresh without refetching the old key", async () => {
    const { result } = renderHook(() => useCollections(0), {
      wrapper: createWrapper(),
    });
    await waitFor(() =>
      expect(collectionsService.getTodayCollections).toHaveBeenCalledTimes(1),
    );

    getManilaBusinessDateMock.mockReturnValue("2026-09-08");
    await act(async () => result.current.refetchDaily());

    await waitFor(() => expect(result.current.dailyDate).toBe("2026-09-08"));
    await waitFor(() =>
      expect(collectionsService.getTodayCollections).toHaveBeenCalledTimes(2),
    );
    expect(
      vi
        .mocked(collectionsService.getTodayCollections)
        .mock.calls.map(([date]) => date),
    ).toEqual(["2026-09-07", "2026-09-08"]);
  });

  it("refreshes the manually selected by-date query without changing its date", async () => {
    const { result } = renderHook(() => useCollections(1), {
      wrapper: createWrapper(),
    });
    await waitFor(() =>
      expect(collectionsService.getAllCollectionGroups).toHaveBeenCalled(),
    );

    act(() => result.current.setAllDate("2026-09-03"));
    await waitFor(() => expect(result.current.allDate).toBe("2026-09-03"));
    await waitFor(() =>
      expect(collectionsService.getAllCollectionGroups).toHaveBeenCalledWith(
        "2026-09-03",
        expect.any(AbortSignal),
      ),
    );

    getManilaBusinessDateMock.mockReturnValue("2026-09-08");
    await act(async () => result.current.refetchAll());

    expect(result.current.allDate).toBe("2026-09-03");
    expect(
      vi
        .mocked(collectionsService.getAllCollectionGroups)
        .mock.calls.at(-1)?.[0],
    ).toBe("2026-09-03");
  });

  it("synchronizes a stale Daily date when the window regains focus", async () => {
    const { result } = renderHook(() => useCollections(0), {
      wrapper: createWrapper(),
    });
    await waitFor(() =>
      expect(collectionsService.getTodayCollections).toHaveBeenCalledTimes(1),
    );

    getManilaBusinessDateMock.mockReturnValue("2026-09-08");
    act(() => window.dispatchEvent(new Event("focus")));

    await waitFor(() => expect(result.current.dailyDate).toBe("2026-09-08"));
    await waitFor(() =>
      expect(collectionsService.getTodayCollections).toHaveBeenCalledTimes(2),
    );
    expect(
      vi
        .mocked(collectionsService.getTodayCollections)
        .mock.calls.map(([date]) => date),
    ).toEqual(["2026-09-07", "2026-09-08"]);
    expect(result.current.allDate).toBe("2026-09-07");
  });

  it("keeps successful counts available when switching between cached tabs", async () => {
    vi.mocked(collectionsService.getTodayCollections).mockResolvedValue([
      group("Daily One", "2026-09-05"),
      group("Daily Two", "2026-09-05"),
    ]);
    vi.mocked(collectionsService.getAllCollectionGroups).mockResolvedValue([
      group("All One", "2026-09-05"),
    ]);

    const { result, rerender } = renderHook(
      ({ activeTab }: { activeTab: CollectionsTab }) =>
        useCollections(activeTab),
      {
        initialProps: { activeTab: 0 as CollectionsTab },
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => expect(result.current.dailyHasData).toBe(true));
    expect(result.current.dailyCollections).toHaveLength(2);
    expect(result.current.allHasData).toBe(false);

    rerender({ activeTab: 1 });
    await waitFor(() => expect(result.current.allHasData).toBe(true));
    expect(result.current.allCollections).toHaveLength(1);

    rerender({ activeTab: 0 });
    expect(result.current.dailyHasData).toBe(true);
    expect(result.current.dailyCollections).toHaveLength(2);
    expect(result.current.allHasData).toBe(true);
    expect(result.current.allCollections).toHaveLength(1);
  });

  it("filters fetched center groups without adding a collection request", async () => {
    vi.mocked(collectionsService.getTodayCollections).mockResolvedValue([
      group("North Center", "2026-09-05"),
      group("South Center", "2026-09-05"),
    ]);

    const { result } = renderHook(() => useCollections(0), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(result.current.dailyCollections).toHaveLength(2),
    );

    act(() => result.current.setSearch("north"));

    await waitFor(() =>
      expect(result.current.dailyCollections).toHaveLength(1),
    );
    expect(result.current.dailyCollections[0]?.centerName).toBe("North Center");
    expect(collectionsService.getTodayCollections).toHaveBeenCalledTimes(1);
  });
});
