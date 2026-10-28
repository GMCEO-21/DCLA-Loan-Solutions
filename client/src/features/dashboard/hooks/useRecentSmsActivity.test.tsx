import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { smsNotificationsApi } from "@features/notifications/api";
import type { RecentSmsActivityResult } from "@features/notifications/types";
import { useRecentSmsActivity } from "./useRecentSmsActivity";

vi.mock("@features/notifications/api", () => ({
  smsNotificationsApi: {
    getRecent: vi.fn(),
  },
}));

const response = {
  items: [],
  summary: { sentToday: 3, pending: 1, failedToday: 0 },
};

describe("useRecentSmsActivity", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads recent SMS data and refetches only through the read endpoint", async () => {
    vi.mocked(smsNotificationsApi.getRecent).mockResolvedValue(response);
    const { result } = renderHook(() => useRecentSmsActivity(10));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(response);
    expect(smsNotificationsApi.getRecent).toHaveBeenCalledTimes(1);
    expect(smsNotificationsApi.getRecent).toHaveBeenCalledWith(
      10,
      expect.any(AbortSignal),
    );

    await act(async () => result.current.refetch());
    expect(smsNotificationsApi.getRecent).toHaveBeenCalledTimes(2);
  });

  it("exposes a focused read error without discarding the dashboard", async () => {
    vi.mocked(smsNotificationsApi.getRecent).mockRejectedValue(
      new Error("Recent SMS unavailable"),
    );
    const { result } = renderHook(() => useRecentSmsActivity());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Recent SMS unavailable");
    expect(result.current.data).toBeNull();
  });

  it("replaces previous activity rows on refresh", async () => {
    const activityItem = (notificationId: string) => ({
      notificationId,
      memberName: "Maria Santos",
      eventType: "loan_created" as const,
      status: "sent" as const,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:01:00.000Z",
      sentAt: "2026-09-01T00:01:00.000Z",
    });
    const initial: RecentSmsActivityResult = {
      ...response,
      items: [activityItem("old")],
    };
    const refreshed: RecentSmsActivityResult = {
      ...response,
      items: [activityItem("new")],
    };
    vi.mocked(smsNotificationsApi.getRecent)
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(refreshed);

    const { result } = renderHook(() => useRecentSmsActivity(10));
    await waitFor(() => expect(result.current.data).toEqual(initial));

    await act(async () => result.current.refetch());

    expect(
      result.current.data?.items.map((item) => item.notificationId),
    ).toEqual(["new"]);
    expect(smsNotificationsApi.getRecent).toHaveBeenCalledTimes(2);
  });
});
