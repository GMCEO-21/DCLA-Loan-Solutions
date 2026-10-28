import { StrictMode, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionsAPI } from "../api";
import type { TransactionHistoryResponse } from "../types";
import { useTransactionHistory } from "./useTransactionHistory";

vi.mock("../api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api")>();
  return {
    ...original,
    TransactionsAPI: { getHistory: vi.fn() },
  };
});

const response = (page: number): TransactionHistoryResponse => ({
  items: [
    {
      id: `transaction-${page}`,
      type: "repayment",
      amount: 100,
      direction: "credit",
      member: { id: "member-1", name: "Member, Test" },
      loan: { id: "loan-1", status: "active" },
      createdAt: "2026-09-05T00:00:00.000Z",
      source: "repayment",
      repaymentOperationType: "payment",
      canReverse: true,
    },
  ],
  total: 50,
  page,
  limit: 25,
  totalPages: 2,
});

function createHarness(strict = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      {strict ? <StrictMode>{children}</StrictMode> : children}
    </QueryClientProvider>
  );
  return { client, wrapper };
}

describe("useTransactionHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(TransactionsAPI.getHistory).mockImplementation(
      async (params = {}) => response(params.page ?? 1),
    );
  });

  it("documents StrictMode cancellation and caches pages independently", async () => {
    const { wrapper } = createHarness(true);
    const { result } = renderHook(() => useTransactionHistory(25), { wrapper });

    await waitFor(() =>
      expect(result.current.transactions[0]?.id).toBe("transaction-1"),
    );
    expect(TransactionsAPI.getHistory).toHaveBeenCalledTimes(2);

    act(() => result.current.setPage(2));
    await waitFor(() =>
      expect(result.current.transactions[0]?.id).toBe("transaction-2"),
    );
    act(() => result.current.setPage(1));
    await waitFor(() =>
      expect(result.current.transactions[0]?.id).toBe("transaction-1"),
    );

    expect(TransactionsAPI.getHistory).toHaveBeenCalledTimes(3);
  });

  it("debounces search changes and passes a cancellation signal", async () => {
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useTransactionHistory(25), { wrapper });
    await waitFor(() =>
      expect(TransactionsAPI.getHistory).toHaveBeenCalledTimes(1),
    );

    act(() => result.current.updateFilters({ search: "m" }));
    act(() => result.current.updateFilters({ search: "me" }));
    act(() => result.current.updateFilters({ search: "member" }));

    await waitFor(() =>
      expect(TransactionsAPI.getHistory).toHaveBeenCalledTimes(2),
    );
    expect(TransactionsAPI.getHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: "member", page: 1, limit: 25 }),
      expect.any(AbortSignal),
    );
  });
});
