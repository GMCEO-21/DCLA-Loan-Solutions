import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRecentSmsActivity } from "../hooks/useRecentSmsActivity";
import { useSmsCredits } from "../hooks/useSmsCredits";
import DashboardPage from "./DashboardPage";

vi.mock("@components/layout/PrivateLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@features/auth/authStore", () => ({
  useAuthStore: () => ({ user: { email: "manager@dcla.test" } }),
}));

vi.mock("../hooks/useRecentSmsActivity", () => ({
  useRecentSmsActivity: vi.fn(),
}));
vi.mock("../hooks/useSmsCredits", () => ({
  useSmsCredits: vi.fn(),
}));

describe("DashboardPage", () => {
  const refetch = vi.fn(async () => undefined);
  const refetchCredits = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRecentSmsActivity).mockReturnValue({
      data: {
        items: [],
        summary: { sentToday: 0, pending: 0, failedToday: 0 },
      },
      loading: false,
      error: null,
      refetch,
    });
    vi.mocked(useSmsCredits).mockReturnValue({
      credits: 1847,
      loading: false,
      error: false,
      refetch: refetchCredits,
    });
  });

  const renderDashboard = () =>
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/approvals" element={<div>Approvals destination</div>} />
        </Routes>
      </MemoryRouter>,
    );

  it("renders the simplified operational dashboard", () => {
    renderDashboard();

    expect(
      screen.getByRole("heading", { name: "Dashboard", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Overview of lending operations and recent activity."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Manager Command Center"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Collection approvals")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review Approvals" }),
    ).toBeInTheDocument();
    expect(screen.getByText("SMS Notifications")).toBeInTheDocument();
    expect(useRecentSmsActivity).toHaveBeenCalledWith(10);
    expect(screen.getByText("1,847 remaining")).toBeInTheDocument();
    expect(screen.queryByText("Total Portfolio")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Center Exposure Overview"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Collection Pulse")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open Portfolio" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "View All" }),
    ).not.toBeInTheDocument();
  });

  it("preserves the approvals navigation action", () => {
    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: "Review Approvals" }));

    expect(screen.getByText("Approvals destination")).toBeInTheDocument();
  });

  it("refreshes recent SMS data and SMS credits independently", () => {
    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(refetchCredits).toHaveBeenCalledTimes(1);
  });

  it("keeps recent SMS activity visible when credits are unavailable", () => {
    vi.mocked(useRecentSmsActivity).mockReturnValue({
      data: {
        items: [
          {
            notificationId: "notification-1",
            memberName: "Maria Santos",
            eventType: "loan_created",
            status: "sent",
            createdAt: "2026-09-01T00:00:00.000Z",
            updatedAt: "2026-09-01T00:01:00.000Z",
            sentAt: "2026-09-01T00:01:00.000Z",
          },
        ],
        summary: { sentToday: 1, pending: 0, failedToday: 0 },
      },
      loading: false,
      error: null,
      refetch,
    });
    vi.mocked(useSmsCredits).mockReturnValue({
      credits: undefined,
      loading: false,
      error: true,
      refetch: refetchCredits,
    });

    renderDashboard();

    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
  });
});
