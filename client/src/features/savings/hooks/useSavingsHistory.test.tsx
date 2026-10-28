import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import savingsService from "../api";
import type { SavingsHistoryResponse, SavingsHistoryScope } from "../types";
import {
  SAVINGS_HISTORY_STALE_TIME,
  savingsHistoryKeys,
  useSavingsHistory,
} from "./useSavingsHistory";

vi.mock("../api", () => ({
  default: { getHistory: vi.fn() },
}));

const response = (
  memberId: string,
  scope: SavingsHistoryScope,
  page: number,
  totalPages = 1,
): SavingsHistoryResponse =>
  scope === "ledger"
    ? {
        scope,
        items: [
          {
            recordClass: "ledger",
            id: `${memberId}-${scope}-${page}`,
            eventType: "manual_deposit",
            amount: "100.00",
            balanceBefore: "0.00",
            balanceAfter: "100.00",
            businessDate: "2026-09-03",
            createdAt: "2026-09-03T00:00:00.000Z",
            remarks: null,
            loanId: null,
            performedBy: null,
            referenceType: null,
            referenceId: null,
            reversalOfId: null,
          },
        ],
        pagination: { page, limit: 25, total: totalPages * 25, totalPages },
      }
    : {
        scope,
        items: [
          {
            recordClass: "legacy",
            id: `${memberId}-${scope}-${page}`,
            amount: "50.00",
            direction: "credit",
            createdAt: "2025-01-01T00:00:00.000Z",
            remarks: null,
          },
        ],
        pagination: { page, limit: 25, total: totalPages * 25, totalPages },
      };

function createHarness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("useSavingsHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(savingsService.getHistory).mockImplementation(
      async ({ memberId, scope, page = 1 }) =>
        response(
          memberId,
          scope,
          page,
          memberId === "member-a" && scope === "ledger" ? 2 : 1,
        ),
    );
  });

  it("caches visited pages and prefetches only the next ledger page", async () => {
    const { wrapper } = createHarness();
    const { result, rerender } = renderHook(
      ({ page }) => useSavingsHistory("member-a", "ledger", page, 25),
      { initialProps: { page: 1 }, wrapper },
    );

    await waitFor(() => expect(result.current.data?.pagination.page).toBe(1));
    await waitFor(() =>
      expect(savingsService.getHistory).toHaveBeenCalledTimes(2),
    );
    expect(savingsService.getHistory).toHaveBeenNthCalledWith(1, {
      memberId: "member-a",
      scope: "ledger",
      page: 1,
      limit: 25,
    });
    expect(savingsService.getHistory).toHaveBeenNthCalledWith(2, {
      memberId: "member-a",
      scope: "ledger",
      page: 2,
      limit: 25,
    });

    rerender({ page: 2 });
    await waitFor(() => expect(result.current.data?.pagination.page).toBe(2));
    rerender({ page: 1 });
    await waitFor(() => expect(result.current.data?.pagination.page).toBe(1));
    expect(savingsService.getHistory).toHaveBeenCalledTimes(2);
  });

  it("isolates cached data by member and scope", async () => {
    const { wrapper } = createHarness();
    const { result, rerender } = renderHook(
      ({ memberId, scope }) => useSavingsHistory(memberId, scope, 1, 25),
      {
        initialProps: {
          memberId: "member-b",
          scope: "ledger" as SavingsHistoryScope,
        },
        wrapper,
      },
    );

    await waitFor(() =>
      expect(result.current.data?.items[0]?.id).toBe("member-b-ledger-1"),
    );
    rerender({ memberId: "member-c", scope: "ledger" });
    await waitFor(() =>
      expect(result.current.data?.items[0]?.id).toBe("member-c-ledger-1"),
    );
    rerender({ memberId: "member-c", scope: "legacy" });
    await waitFor(() =>
      expect(result.current.data?.items[0]?.id).toBe("member-c-legacy-1"),
    );

    expect(savingsService.getHistory).toHaveBeenCalledTimes(3);
  });

  it("shows stale cached data while background-refreshing it", async () => {
    const { client, wrapper } = createHarness();
    const key = savingsHistoryKeys.page("member-d", "ledger", 1, 25);
    client.setQueryData(key, response("cached", "ledger", 1), {
      updatedAt: Date.now() - SAVINGS_HISTORY_STALE_TIME - 1,
    });

    const { result } = renderHook(
      () => useSavingsHistory("member-d", "ledger", 1, 25),
      { wrapper },
    );

    expect(result.current.data?.items[0]?.id).toBe("cached-ledger-1");
    await waitFor(() =>
      expect(savingsService.getHistory).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(result.current.data?.items[0]?.id).toBe("member-d-ledger-1"),
    );
  });
});
