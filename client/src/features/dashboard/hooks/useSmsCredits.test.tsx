import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { smsNotificationsApi } from "@features/notifications/api";
import { smsCreditsQueryKey, useSmsCredits } from "./useSmsCredits";

vi.mock("@features/notifications/api", () => ({
  smsNotificationsApi: {
    getCredits: vi.fn(),
  },
}));

function createHarness() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe("useSmsCredits", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([1847, 0])("preserves the credit balance %s", async (credits) => {
    vi.mocked(smsNotificationsApi.getCredits).mockResolvedValue({ credits });
    const { queryClient, wrapper } = createHarness();
    const { result } = renderHook(() => useSmsCredits(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.credits).toBe(credits);
    expect(result.current.error).toBe(false);
    expect(smsNotificationsApi.getCredits).toHaveBeenCalledWith(
      expect.any(AbortSignal),
    );
    expect(queryClient.getQueryData(smsCreditsQueryKey)).toEqual({ credits });

    const query = queryClient.getQueryCache().find(smsCreditsQueryKey);
    expect(query?.options).toMatchObject({
      staleTime: 2 * 60_000,
      cacheTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: false,
    });
  });

  it("exposes an unavailable state without inventing a zero balance", async () => {
    vi.mocked(smsNotificationsApi.getCredits).mockRejectedValue(
      new Error("provider unavailable"),
    );
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useSmsCredits(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.credits).toBeUndefined();
    expect(result.current.error).toBe(true);
    expect(smsNotificationsApi.getCredits).toHaveBeenCalledTimes(1);
  });
});
