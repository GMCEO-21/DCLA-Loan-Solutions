import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePortfolio } from "../hooks/usePortfolio";
import PortfolioPage from "./PortfolioPage";

vi.mock("@components/layout/PrivateLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../hooks/usePortfolio", () => ({ usePortfolio: vi.fn() }));
vi.mock("../components/RevenueView", () => ({
  default: () => <div>Revenue view content</div>,
}));
vi.mock("../components/ProjectedIncomeView", () => ({
  default: () => <div>Projected income view content</div>,
}));

const refetch = vi.fn();
const portfolio = {
  totalAmountDisbursed: 125000,
  totalOutstandingCollection: 42500,
  centers: [
    {
      no: 1,
      centerName: "Central Center",
      amountDisbursed: 125000,
      outstandingCollection: 42500,
    },
  ],
};

describe("PortfolioPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePortfolio).mockReturnValue({
      data: portfolio,
      loading: false,
      error: null,
      refetch,
    });
  });

  it("renders the operational header, unchanged metrics, and overview table", () => {
    render(<PortfolioPage />);

    expect(
      screen.getByRole("heading", { name: "Portfolio", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Monitor lending portfolio and revenue performance."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("₱125,000.00")).toHaveLength(3);
    expect(screen.getAllByText("₱42,500.00")).toHaveLength(3);
    expect(screen.getByText("Central Center")).toBeInTheDocument();
    expect(screen.getByLabelText("Search centers")).toBeInTheDocument();
    expect(screen.getByLabelText("Rows")).toBeInTheDocument();
  });

  it("keeps secondary views lazy and preserves refresh behavior", () => {
    render(<PortfolioPage />);

    expect(screen.queryByText("Revenue view content")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Revenue" }));
    expect(screen.getByText("Revenue view content")).toBeInTheDocument();
    expect(
      screen.queryByText("Projected income view content"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Projected Income" }));
    expect(
      screen.getByText("Projected income view content"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("does not render fake financial values while loading or on error", () => {
    vi.mocked(usePortfolio).mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch,
    });
    const { rerender } = render(<PortfolioPage />);

    expect(screen.getByLabelText("Loading portfolio")).toBeInTheDocument();
    expect(screen.queryByText(/₱/)).not.toBeInTheDocument();

    vi.mocked(usePortfolio).mockReturnValue({
      data: null,
      loading: false,
      error: "Unable to load portfolio.",
      refetch,
    });
    rerender(<PortfolioPage />);

    expect(screen.getByText("Unable to load portfolio.")).toBeInTheDocument();
    expect(screen.queryByText(/₱0\.00/)).not.toBeInTheDocument();
  });

  it("shows successful zero data as a valid empty state", () => {
    vi.mocked(usePortfolio).mockReturnValue({
      data: {
        totalAmountDisbursed: 0,
        totalOutstandingCollection: 0,
        centers: [],
      },
      loading: false,
      error: null,
      refetch,
    });
    render(<PortfolioPage />);

    expect(screen.getAllByText("₱0.00")).toHaveLength(2);
    expect(
      screen.getByText("No portfolio records available."),
    ).toBeInTheDocument();
  });
});
