import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  RecentSmsActivityItem,
  RecentSmsActivityResult,
  SmsNotificationStatus,
} from "@features/notifications/types";
import RecentSmsActivity from "./RecentSmsActivity";
import {
  formatSmsActivityTime,
  selectSmsActivityTimestamp,
} from "../utils/recentSmsActivity";

const item = (
  notificationId: string,
  status: SmsNotificationStatus,
  overrides: Partial<RecentSmsActivityItem> = {},
): RecentSmsActivityItem => ({
  notificationId,
  memberName: "Maria Santos",
  eventType: "loan_created",
  status,
  createdAt: "2026-08-31T16:10:00.000Z",
  updatedAt: "2026-08-31T16:20:00.000Z",
  sentAt: "2026-08-31T16:30:00.000Z",
  ...overrides,
});

const result = (items: RecentSmsActivityItem[]): RecentSmsActivityResult => ({
  items,
  summary: { sentToday: 24, pending: 2, failedToday: 1 },
});

const creditsProps = {
  credits: 1847,
  creditsLoading: false,
  creditsError: false,
};

describe("RecentSmsActivity", () => {
  it("renders the compact summary and user-friendly event labels", () => {
    render(
      <RecentSmsActivity
        data={result([
          item("loan", "sent"),
          item("repayment", "pending", {
            memberName: "Unknown client",
            eventType: "repayment_posted",
          }),
        ])}
        loading={false}
        error={null}
        {...creditsProps}
      />,
    );

    const summary = screen.getByLabelText("SMS notification summary");
    expect(within(summary).getByText("Sent today")).toBeInTheDocument();
    expect(within(summary).getByText("24")).toBeInTheDocument();
    expect(within(summary).getByText("Pending")).toBeInTheDocument();
    expect(within(summary).getByText("2")).toBeInTheDocument();
    expect(within(summary).getByText("Failed today")).toBeInTheDocument();
    expect(within(summary).getByText("1")).toBeInTheDocument();
    expect(within(summary).getByText("SMS Credits")).toBeInTheDocument();
    expect(within(summary).getByText("1,847 remaining")).toBeInTheDocument();
    expect(screen.getByText("Loan Approval")).toBeInTheDocument();
    expect(screen.getByText("Repayment")).toBeInTheDocument();
    expect(screen.getByText("Unknown client")).toBeInTheDocument();
  });

  it("renders every status and selects its required timestamp", () => {
    const rows = [
      item("sent", "sent"),
      item("pending", "pending"),
      item("processing", "processing"),
      item("failed", "failed"),
    ];
    render(
      <RecentSmsActivity
        data={result(rows)}
        loading={false}
        error={null}
        {...creditsProps}
      />,
    );

    for (const status of ["sent", "pending", "processing", "failed"]) {
      expect(screen.getByText(status)).toBeInTheDocument();
    }
    expect(selectSmsActivityTimestamp(rows[0])).toBe(rows[0].sentAt);
    expect(selectSmsActivityTimestamp(rows[1])).toBe(rows[1].createdAt);
    expect(selectSmsActivityTimestamp(rows[2])).toBe(rows[2].updatedAt);
    expect(selectSmsActivityTimestamp(rows[3])).toBe(rows[3].updatedAt);
  });

  it("falls back to createdAt for a sent item without sentAt", () => {
    const sent = item("sent", "sent", { sentAt: null });
    expect(selectSmsActivityTimestamp(sent)).toBe(sent.createdAt);
  });

  it("formats timestamps explicitly in Asia/Manila", () => {
    expect(formatSmsActivityTime("2026-08-31T16:00:00.000Z")).toBe(
      "Sep 1, 2026, 12:00 AM",
    );
  });

  it("renders loading, empty, and focused error states", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <RecentSmsActivity data={null} loading error={null} {...creditsProps} />,
    );
    expect(screen.getByTestId("recent-sms-loading")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();

    rerender(
      <RecentSmsActivity
        data={result([])}
        loading={false}
        error={null}
        {...creditsProps}
      />,
    );
    expect(screen.getByText("No SMS notifications yet.")).toBeInTheDocument();

    rerender(
      <RecentSmsActivity
        data={null}
        loading={false}
        error="Unable to load recent SMS activity."
        {...creditsProps}
        onRetry={onRetry}
      />,
    );
    expect(
      screen.getByText("Unable to load recent SMS activity."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("distinguishes zero, loading, and unavailable credit states", () => {
    const { rerender } = render(
      <RecentSmsActivity
        data={result([])}
        loading={false}
        error={null}
        credits={0}
        creditsLoading={false}
        creditsError={false}
      />,
    );
    expect(screen.getByText("0 remaining")).toBeInTheDocument();

    rerender(
      <RecentSmsActivity
        data={result([])}
        loading={false}
        error={null}
        credits={undefined}
        creditsLoading
        creditsError={false}
      />,
    );
    expect(screen.queryByText("0 remaining")).not.toBeInTheDocument();
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();

    rerender(
      <RecentSmsActivity
        data={result([item("loan", "sent")])}
        loading={false}
        error={null}
        credits={undefined}
        creditsLoading={false}
        creditsError
      />,
    );
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
  });
});
