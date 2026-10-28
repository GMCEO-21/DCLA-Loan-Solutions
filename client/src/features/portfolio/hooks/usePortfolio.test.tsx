import { act, renderHook, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { portfolioService } from "../api";
import { usePortfolio } from "./usePortfolio";

vi.mock("../api", () => ({
  portfolioService: { getPortfolioData: vi.fn() },
}));

function serverError() {
  return new AxiosError("internal failure", undefined, undefined, undefined, {
    status: 500,
    statusText: "Internal Server Error",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { message: "database details" },
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

describe("usePortfolio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(portfolioService.getPortfolioData).mockRejectedValue(
      serverError(),
    );
  });

  it("returns a safe server error and supports retry", async () => {
    const { result } = renderHook(() => usePortfolio(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toContain("server could not complete");
    expect(result.current.error).not.toContain("database details");

    await act(async () => {
      await result.current.refetch();
    });

    expect(portfolioService.getPortfolioData).toHaveBeenCalledTimes(2);
    expect(portfolioService.getPortfolioData).toHaveBeenLastCalledWith(
      expect.any(AbortSignal),
    );
  });
});
