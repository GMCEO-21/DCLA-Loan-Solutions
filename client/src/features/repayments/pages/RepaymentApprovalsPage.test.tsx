import { fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { theme } from "../../../theme/theme";
import RepaymentApprovalsPage from "./RepaymentApprovalsPage";

const useRepaymentApprovalsMock = vi.hoisted(() => vi.fn());
const repaymentsServiceMock = vi.hoisted(() => ({
  getPendingForCollection: vi.fn(),
  getAllocationPreview: vi.fn(),
}));

vi.mock("../hooks/useRepaymentApprovals", () => ({
  useRepaymentApprovals: useRepaymentApprovalsMock,
}));
vi.mock("../api", () => ({ repaymentsService: repaymentsServiceMock }));
vi.mock("@components/layout/PrivateLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@features/notifications/api", () => ({
  smsNotificationsApi: { getRepaymentEligibility: vi.fn() },
}));
vi.mock("@features/notifications/components/SendSmsConfirmationDialog", () => ({
  default: () => null,
}));

const pendingCollection = {
  batchId: "batch-1",
  centerId: "center-1",
  centerName: "North Center",
  collectionDate: "2026-09-07",
  pendingCount: 2,
  paymentCount: 1,
  reversalCount: 1,
  paymentAmount: 1500,
  reversalAmount: 500,
  netAmount: 1000,
};

const actions = {
  refresh: vi.fn(),
  approveCollection: vi.fn(),
  rejectCollection: vi.fn(),
};

const defaultState = {
  pendingCollections: [pendingCollection],
  loading: false,
  error: null,
  actingIds: new Set<string>(),
  getActionKey: (centerId: string, date: string, batchId?: string | null) =>
    `${batchId ?? "legacy"}::${centerId}::${date}`,
  ...actions,
};

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <RepaymentApprovalsPage />
    </ThemeProvider>,
  );
}

describe("RepaymentApprovalsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.approveCollection.mockResolvedValue({
      batchId: "batch-1",
      centerId: "center-1",
      collectionDate: "2026-09-07",
      processedCount: 2,
      approvedCount: 2,
      approvedPaymentIds: [],
    });
    actions.rejectCollection.mockResolvedValue(undefined);
    repaymentsServiceMock.getPendingForCollection.mockResolvedValue([]);
    useRepaymentApprovalsMock.mockReturnValue(defaultState);
  });

  it("renders the operational approval surface and filters existing rows", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Approvals", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Review and manage pending collection approvals."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Approval filters" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 collection / 2 pending entries"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Net Total" }),
    ).toBeInTheDocument();
    expect(screen.getByText("North Center")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("₱1,500")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search approvals"), {
      target: { value: "missing" },
    });

    expect(
      screen.getByText("No pending approvals match your search."),
    ).toBeInTheDocument();
    expect(screen.queryByText("North Center")).not.toBeInTheDocument();
  });

  it("preserves the confirmed collection approval call", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = screen.getByRole("dialog", { name: "Approve collection" });
    expect(within(dialog).getByText(/North Center/)).toBeInTheDocument();
    await within(dialog).findByText(
      "No payment allocations in this collection.",
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Approve Collection" }),
    );

    expect(actions.approveCollection).toHaveBeenCalledWith(
      "center-1",
      "2026-09-07",
      "batch-1",
    );
    expect(
      await screen.findByText("Collection approved successfully."),
    ).toBeInTheDocument();
  });

  it("shows the server-calculated charge allocation before approval", async () => {
    repaymentsServiceMock.getPendingForCollection.mockResolvedValue([
      { id: "repayment-1", operationType: "payment" },
    ]);
    repaymentsServiceMock.getAllocationPreview.mockResolvedValue({
      repaymentId: "repayment-1",
      loanId: "12345678-0000-4000-8000-000000000001",
      asOfDate: "2026-09-07",
      allocation: {
        eligible: true,
        cashReceived: 500,
        savingsUsed: 50,
        totalApplied: 550,
        penalty: { amount: 100, cashPortion: 100, savingsPortion: 0 },
        pastDueInterest: { amount: 20, cashPortion: 20, savingsPortion: 0 },
        contractual: { amount: 430, cashPortion: 380, savingsPortion: 50 },
        unapplied: 0,
      },
    });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = screen.getByRole("dialog", { name: "Approve collection" });
    const loanCell = await within(dialog).findByText("12345678...");
    const allocationRow = loanCell.closest("tr");

    expect(repaymentsServiceMock.getAllocationPreview).toHaveBeenCalledWith(
      "repayment-1",
    );
    expect(allocationRow).not.toBeNull();
    expect(within(allocationRow!).getByText("\u20B1100")).toBeInTheDocument();
    expect(within(allocationRow!).getByText("\u20B120")).toBeInTheDocument();
    expect(within(allocationRow!).getByText("\u20B1430")).toBeInTheDocument();
    expect(within(allocationRow!).getByText("\u20B150")).toBeInTheDocument();
  });

  it("preserves the rejection reason and collection rejection call", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog", { name: "Reject collection" });
    fireEvent.change(
      within(dialog).getByLabelText("Rejection reason (optional)"),
      { target: { value: "Incorrect amount" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Reject Collection" }),
    );

    expect(actions.rejectCollection).toHaveBeenCalledWith(
      "center-1",
      "2026-09-07",
      "Incorrect amount",
      "batch-1",
    );
    expect(await screen.findByText("Collection rejected.")).toBeInTheDocument();
  });

  it("shows request errors separately from the successful empty state", () => {
    useRepaymentApprovalsMock.mockReturnValue({
      ...defaultState,
      pendingCollections: [],
      error: "Unable to load approvals.",
    });

    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load approvals.",
    );
    expect(
      screen.queryByText("No pending collection approvals."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(actions.refresh).toHaveBeenCalledOnce();
  });

  it("uses the shared operational loading structure", () => {
    useRepaymentApprovalsMock.mockReturnValue({
      ...defaultState,
      pendingCollections: [],
      loading: true,
    });

    renderPage();

    expect(
      screen.getByRole("status", { name: "Loading operational records" }),
    ).toBeInTheDocument();
  });
});
