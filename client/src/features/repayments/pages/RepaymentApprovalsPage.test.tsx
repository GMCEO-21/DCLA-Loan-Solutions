import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { theme } from "../../../theme/theme";
import RepaymentApprovalsPage from "./RepaymentApprovalsPage";

const useRepaymentApprovalsMock = vi.hoisted(() => vi.fn());
const saveAsMock = vi.hoisted(() => vi.fn());
const repaymentsServiceMock = vi.hoisted(() => ({
  getPendingForCollection: vi.fn(),
  getAllocationPreview: vi.fn(),
}));

vi.mock("../hooks/useRepaymentApprovals", () => ({
  useRepaymentApprovals: useRepaymentApprovalsMock,
}));
vi.mock("../api", () => ({ repaymentsService: repaymentsServiceMock }));
vi.mock("file-saver", () => ({ saveAs: saveAsMock }));
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

const paymentPosting = {
  id: "repayment-1",
  operationType: "payment",
  amount: 1500,
  status: "pending",
  createdAt: "2026-09-07T01:00:00Z",
  member: { id: "member-1", firstName: "Maria", lastName: "Cruz" },
  loan: { id: "loan-1", status: "active", balance: "3000.00" },
};

const reversalPosting = {
  id: "reversal-1",
  operationType: "reversal",
  amount: 500,
  status: "pending",
  createdAt: "2026-09-07T02:00:00Z",
  member: { id: "member-2", firstName: "Ana", lastName: "Reyes" },
  loan: { id: "loan-2", status: "paid", balance: "0.00" },
};

const paymentPreview = {
  repaymentId: "repayment-1",
  loanId: "loan-1",
  asOfDate: "2026-09-07",
  allocation: {
    eligible: false,
    cashReceived: 1500,
    savingsUsed: 0,
    totalApplied: 1500,
    penalty: { amount: 0, cashPortion: 0, savingsPortion: 0 },
    pastDueInterest: { amount: 0, cashPortion: 0, savingsPortion: 0 },
    contractual: { amount: 1500, cashPortion: 1500, savingsPortion: 0 },
    unapplied: 0,
  },
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
    vi.resetAllMocks();
    actions.approveCollection.mockResolvedValue({
      batchId: "batch-1",
      centerId: "center-1",
      collectionDate: "2026-09-07",
      processedCount: 2,
      approvedCount: 2,
      approvedPaymentIds: [],
    });
    actions.rejectCollection.mockResolvedValue(undefined);
    repaymentsServiceMock.getPendingForCollection.mockResolvedValue([
      paymentPosting, reversalPosting,
    ]);
    repaymentsServiceMock.getAllocationPreview.mockResolvedValue(paymentPreview);
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
    await within(dialog).findByText("Maria Cruz");
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Approve Collection" })).toBeEnabled(),
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
      {
        ...paymentPosting,
        loan: { ...paymentPosting.loan, id: "12345678-0000-4000-8000-000000000001" },
      },
      reversalPosting,
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
    await waitFor(() => expect(within(dialog).getByText("₱430.00")).toBeInTheDocument());
    const borrowerCell = within(dialog).getByText("Maria Cruz");
    const allocationRow = borrowerCell.closest("tr");

    expect(repaymentsServiceMock.getAllocationPreview).toHaveBeenCalledWith(
      "repayment-1",
    );
    expect(allocationRow).not.toBeNull();
    expect(within(allocationRow!).getByText("\u20B1100.00")).toBeInTheDocument();
    expect(within(allocationRow!).getByText("\u20B120.00")).toBeInTheDocument();
    expect(within(allocationRow!).getByText("\u20B1430.00")).toBeInTheDocument();
    expect(within(allocationRow!).getByText("\u20B150.00")).toBeInTheDocument();
    expect(within(allocationRow!).getByText("₱1,500.00")).toBeInTheDocument();
  });

  it("shows borrower names and posted amounts for payments and reversals before approval", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = screen.getByRole("dialog", { name: "Approve collection" });
    const borrower = await within(dialog).findByText("Maria Cruz");
    const reversal = within(dialog).getByText("Ana Reyes");
    expect(within(borrower.closest("tr")!).getByText("Payment")).toBeInTheDocument();
    expect(within(borrower.closest("tr")!).getAllByText("₱1,500.00")).toHaveLength(2);
    expect(within(reversal.closest("tr")!).getByText("Reversal")).toBeInTheDocument();
    expect(within(reversal.closest("tr")!).getByText("₱500.00")).toBeInTheDocument();
    expect(within(dialog).getByText("Posting ref: repayment-1")).toBeInTheDocument();
    expect(within(dialog).getByText("Posting ref: reversal-1")).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Approve Collection" })).toBeEnabled());
    expect(repaymentsServiceMock.getAllocationPreview).not.toHaveBeenCalledWith("reversal-1");
    expect(actions.approveCollection).not.toHaveBeenCalled();
  });

  it("flags a payment on a paid loan and blocks approval instead of showing a misleading allocation", async () => {
    repaymentsServiceMock.getPendingForCollection.mockResolvedValue([
      { ...paymentPosting, amount: 450, loan: { ...paymentPosting.loan, status: "paid", balance: "0.00" } },
      reversalPosting,
    ]);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = screen.getByRole("dialog", { name: "Approve collection" });
    expect(await within(dialog).findByText(/Payment is attached to a paid loan/)).toBeInTheDocument();
    expect(within(dialog).getByText("Maria Cruz")).toBeInTheDocument();
    expect(within(dialog).getByText("₱450.00")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Approve Collection" })).toBeDisabled();
    expect(repaymentsServiceMock.getAllocationPreview).not.toHaveBeenCalled();
    expect(actions.approveCollection).not.toHaveBeenCalled();
  });

  it("retains names and blocks approval when an allocation request fails", async () => {
    repaymentsServiceMock.getAllocationPreview.mockRejectedValue(new Error("Preview unavailable"));
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = screen.getByRole("dialog", { name: "Approve collection" });
    expect(await within(dialog).findByText(/Allocation unavailable: Preview unavailable/)).toBeInTheDocument();
    expect(within(dialog).getByText("Maria Cruz")).toBeInTheDocument();
    expect(within(dialog).getByText("Ana Reyes")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Approve Collection" })).toBeDisabled();
  });

  it("blocks approval when the posting list cannot be loaded", async () => {
    repaymentsServiceMock.getPendingForCollection.mockRejectedValue(new Error("Postings unavailable"));
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = screen.getByRole("dialog", { name: "Approve collection" });
    expect(await within(dialog).findByText("Postings unavailable")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Approve Collection" })).toBeDisabled();
  });

  it("blocks an allocation response that belongs to another posting", async () => {
    repaymentsServiceMock.getAllocationPreview.mockResolvedValue({ ...paymentPreview, repaymentId: "different-posting" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = screen.getByRole("dialog", { name: "Approve collection" });
    expect(await within(dialog).findByText(/Allocation does not match this posting/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Approve Collection" })).toBeDisabled();
  });

  it("ignores a slow result from a closed review when another collection is opened", async () => {
    let resolveOld: (value: typeof paymentPosting[]) => void = () => {};
    repaymentsServiceMock.getPendingForCollection.mockImplementationOnce(
      () => new Promise((resolve) => { resolveOld = resolve; }),
    );
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    let dialog = screen.getByRole("dialog", { name: "Approve collection" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    dialog = screen.getByRole("dialog", { name: "Approve collection" });
    await within(dialog).findByText("Maria Cruz");
    resolveOld([{ ...paymentPosting, member: { id: "old-member", firstName: "Old", lastName: "Result" } }]);
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Approve Collection" })).toBeEnabled());
    expect(within(dialog).queryByText("Old Result")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Maria Cruz")).toBeInTheDocument();
  });

  it("requires refresh when the displayed collection no longer matches the pending list", async () => {
    repaymentsServiceMock.getPendingForCollection.mockResolvedValue([paymentPosting]);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = screen.getByRole("dialog", { name: "Approve collection" });
    expect(await within(dialog).findByText(/Pending postings have changed/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Approve Collection" })).toBeDisabled();
  });

  it("does not approve an empty list and offers a named posting export for a loaded list", async () => {
    repaymentsServiceMock.getPendingForCollection.mockResolvedValueOnce([]);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    let dialog = screen.getByRole("dialog", { name: "Approve collection" });
    await within(dialog).findByText(/No pending postings in this collection/);
    expect(within(dialog).getByRole("button", { name: "Approve Collection" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    dialog = screen.getByRole("dialog", { name: "Approve collection" });
    const download = await within(dialog).findByRole("button", { name: "Download posting list" });
    await waitFor(() => expect(download).toBeEnabled());
    fireEvent.click(download);
    expect(saveAsMock).toHaveBeenCalledWith(expect.any(Blob), "pending-postings-2026-09-07-center-1.csv");
    expect(actions.approveCollection).not.toHaveBeenCalled();
  });

  it("refreshes pending collections after an approval error that may have partially processed entries", async () => {
    actions.approveCollection.mockRejectedValue(new Error("Cannot pay a non-active loan"));
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = screen.getByRole("dialog", { name: "Approve collection" });
    const confirm = within(dialog).getByRole("button", { name: "Approve Collection" });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);
    expect(await screen.findByText("Cannot pay a non-active loan")).toBeInTheDocument();
    expect(actions.refresh).toHaveBeenCalledOnce();
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
