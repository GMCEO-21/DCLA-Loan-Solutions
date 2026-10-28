import { act, renderHook, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CentersAPI } from "../api";
import { useCenters } from "./useCenters";

vi.mock("../api", () => ({
  CentersAPI: {
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

describe("useCenters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(CentersAPI.getAll).mockRejectedValue(
      new AxiosError("missing", undefined, undefined, undefined, {
        status: 404,
        statusText: "Not Found",
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { message: "internal lookup detail" },
      }),
    );
  });

  it("returns a clear resource-not-found state", async () => {
    const { result } = renderHook(() => useCenters(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("The requested resource was not found.");
    expect(result.current.error).not.toContain("internal lookup detail");
  });

  it("passes a cancellation signal and invalidates cached lists after mutation", async () => {
    vi.mocked(CentersAPI.getAll).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 3,
      totalPages: 1,
    });
    vi.mocked(CentersAPI.create).mockResolvedValue({
      id: "center-1",
      name: "Center 1",
      collectionDay: "Friday",
    });

    const { result } = renderHook(() => useCenters(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(CentersAPI.getAll).toHaveBeenCalledWith(
      { page: 1, limit: 3, search: undefined },
      expect.any(AbortSignal),
    );

    await act(async () => {
      await result.current.createCenter({
        name: "Center 1",
        collectionDay: "Friday",
        address: "",
      });
    });
    await waitFor(() => expect(CentersAPI.getAll).toHaveBeenCalledTimes(2));
  });
});
