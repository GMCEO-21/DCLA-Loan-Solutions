import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActualRevenue } from "../hooks/useActualRevenue";
import { useExpectedRevenue } from "../hooks/useExpectedRevenue";
import { useProjectedIncome } from "../hooks/useProjectedIncome";
import ActualRevenueView from "./ActualRevenueView";
import ExpectedRevenueView from "./ExpectedRevenueView";
import ProjectedIncomeView from "./ProjectedIncomeView";

vi.mock("../hooks/useActualRevenue", () => ({ useActualRevenue: vi.fn() }));
vi.mock("../hooks/useExpectedRevenue", () => ({ useExpectedRevenue: vi.fn() }));
vi.mock("../hooks/useProjectedIncome", () => ({ useProjectedIncome: vi.fn() }));

const refetch = vi.fn();
const availableMonths = [{ month: 9, year: 2026, label: "September 2026" }];

describe("Portfolio revenue and projection views", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useExpectedRevenue).mockReturnValue({
      data: {
        granularity: "monthly",
        availableMonths,
        totalExpectedInterest: 1200,
        totalServiceCharge: 300,
        totalNotarialFee: 100,
        totalRevenue: 1600,
        periods: [
          {
            periodKey: "2026-09",
            periodLabel: "September 2026",
            expectedInterest: 1200,
            serviceCharge: 300,
            notarialFee: 100,
            totalRevenue: 1600,
          },
        ],
      },
      loading: false,
      error: null,
      refetch,
    });
    vi.mocked(useActualRevenue).mockReturnValue({
      data: {
        granularity: "monthly",
        availableMonths,
        totalActualCollectedInterest: 900,
        totalServiceCharge: 300,
        totalNotarialFee: 100,
        totalRevenue: 1300,
        periods: [
          {
            periodKey: "2026-09",
            periodLabel: "September 2026",
            actualCollectedInterest: 900,
            serviceCharge: 300,
            notarialFee: 100,
            totalRevenue: 1300,
          },
        ],
      },
      loading: false,
      error: null,
      refetch,
    });
    vi.mocked(useProjectedIncome).mockReturnValue({
      data: {
        totalOutstandingBalance: 45000,
        totalInterestIncome: 9000,
        centers: [
          {
            no: 1,
            centerName: "Central Center",
            outstandingBalance: 45000,
            interestIncome: 9000,
          },
        ],
      },
      loading: false,
      error: null,
      refetch,
    });
  });

  it("preserves expected revenue totals and period switching", () => {
    render(<ExpectedRevenueView />);

    expect(screen.getAllByText("₱1,600.00")).toHaveLength(3);
    expect(screen.getByText("September 2026")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByLabelText("Period"));
    fireEvent.click(screen.getByRole("option", { name: "Weekly" }));

    expect(useExpectedRevenue).toHaveBeenLastCalledWith(
      "weekly",
      expect.objectContaining({
        month: expect.any(Number),
        year: expect.any(Number),
      }),
    );
  });

  it("preserves actual revenue totals and labels", () => {
    render(<ActualRevenueView />);

    expect(screen.getAllByText("₱1,300.00")).toHaveLength(3);
    expect(screen.getAllByText("Actual Collected Interest")).toHaveLength(2);
    expect(useActualRevenue).toHaveBeenCalledWith("monthly", undefined);
  });

  it("preserves projected income values and refresh", () => {
    render(<ProjectedIncomeView />);

    expect(screen.getAllByText("₱45,000.00")).toHaveLength(3);
    expect(screen.getAllByText("₱9,000.00")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
