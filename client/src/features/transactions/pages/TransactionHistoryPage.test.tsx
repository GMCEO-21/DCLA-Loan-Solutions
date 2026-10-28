import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { theme } from "../../../theme/theme";
import TransactionHistoryPage from "./TransactionHistoryPage";

const useTransactionHistoryMock = vi.hoisted(() => vi.fn());
const requestReversalMock = vi.hoisted(() => vi.fn());
let currentRole = "cashier";

vi.mock("../hooks/useTransactionHistory", () => ({
  useTransactionHistory: useTransactionHistoryMock,
}));
vi.mock("@components/layout/PrivateLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@features/auth/authStore", () => ({
  useAuthStore: (selector: (state: { user: { role: string } }) => unknown) =>
    selector({ user: { role: currentRole } }),
}));
vi.mock("@features/repayments/api", () => ({
  repaymentsService: { requestReversal: requestReversalMock },
}));

const transactions = [
  {
    id: "repayment-1",
    type: "repayment" as const,
    amount: 1500,
    direction: "credit" as const,
    member: {
      id: "member-1",
      name: "Member, Maria",
      center: { id: "center-1", name: "North Center" },
    },
    loan: { id: "loan-1", status: "active" },
    notes: "Weekly payment",
    createdAt: "2026-09-03T15:14:29.683Z",
    collectionDate: "2026-09-03",
    source: "repayment" as const,
    repaymentOperationType: "payment" as const,
    canReverse: true,
  },
  {
    id: "repayment-blocked-1",
    type: "repayment" as const,
    amount: 1000,
    direction: "credit" as const,
    member: {
      id: "member-3",
      name: "Member, Blocked",
      center: { id: "center-1", name: "North Center" },
    },
    loan: { id: "loan-2", status: "active" },
    notes: "Pending reversal",
    createdAt: "2026-09-03T15:16:29.683Z",
    collectionDate: "2026-09-03",
    source: "repayment" as const,
    repaymentOperationType: "payment" as const,
    canReverse: false,
  },
  {
    id: "repayment-reversal-1",
    type: "repayment" as const,
    amount: 750,
    direction: "debit" as const,
    member: {
      id: "member-1",
      name: "Member, Maria",
      center: { id: "center-1", name: "North Center" },
    },
    loan: { id: "loan-1", status: "active" },
    notes: "Duplicate payment reversal",
    createdAt: "2026-09-03T15:15:29.683Z",
    collectionDate: "2026-09-03",
    source: "repayment" as const,
    repaymentOperationType: "reversal" as const,
    canReverse: false,
  },
  {
    id: "savings-1",
    type: "savings_deposit" as const,
    amount: 500,
    direction: "credit" as const,
    member: {
      id: "member-2",
      name: "Member, Ana",
      center: { id: "center-2", name: "South Center" },
    },
    loan: { id: null, status: null },
    notes: "Deposit",
    createdAt: "2026-09-03T16:30:00.000Z",
    source: "savings" as const,
    canReverse: false,
  },
  {
    id: "savings-2",
    type: "savings_withdrawal" as const,
    amount: 250,
    direction: "debit" as const,
    member: {
      id: "member-2",
      name: "Member, Ana",
      center: { id: "center-2", name: "South Center" },
    },
    loan: { id: null, status: null },
    notes: "Withdrawal",
    createdAt: "2026-09-03T16:31:00.000Z",
    source: "savings" as const,
    canReverse: false,
  },
];

const actions = {
  setPage: vi.fn(),
  setLimit: vi.fn(),
  updateFilters: vi.fn(),
  refresh: vi.fn(),
};

const defaultState = {
  transactions,
  loading: false,
  error: null,
  page: 1,
  limit: 25,
  totalPages: 3,
  total: 52,
  filters: { search: "", type: "all", startDate: "", endDate: "" },
  ...actions,
};

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <TransactionHistoryPage />
    </ThemeProvider>,
  );
}

describe("TransactionHistoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRole = "cashier";
    actions.refresh.mockResolvedValue(undefined);
    requestReversalMock.mockResolvedValue(undefined);
    useTransactionHistoryMock.mockReturnValue(defaultState);
  });

  it("renders the operational table with accessible filters and Manila timestamps", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Transaction History", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Review financial transaction activity and history."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Transaction filters" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Search transactions")).toBeInTheDocument();
    expect(screen.getByLabelText("Transaction type")).toBeInTheDocument();
    expect(screen.getByLabelText("Start date")).toBeInTheDocument();
    expect(screen.getByLabelText("End date")).toBeInTheDocument();

    expect(screen.getByText("Sep 3, 2026, 11:14 PM")).toBeInTheDocument();
    expect(screen.getByText("Sep 4, 2026, 12:30 AM")).toBeInTheDocument();
    expect(screen.getByText("₱1,500")).toBeInTheDocument();
    expect(screen.getAllByText("Loan Repayment")).toHaveLength(2);
    expect(screen.getByText("Repayment Reversal")).toBeInTheDocument();
    expect(screen.getByText("Savings Deposit")).toBeInTheDocument();
    expect(screen.getByText("Savings Withdrawal")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Date & Time" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Transaction" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Direction" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Notes" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Weekly payment")).not.toBeInTheDocument();
    expect(screen.getByText("5 shown of 52 records")).toBeInTheDocument();
    const summary = screen.getByLabelText("Current page transaction summary");
    expect(within(summary).getByText("Current page:")).toBeInTheDocument();
    expect(summary).toHaveTextContent("Repayments: 2");
    expect(summary).toHaveTextContent("Reversals: 1");
    expect(screen.queryByText("Loan #loan-1")).not.toBeInTheDocument();
  });

  it("preserves filter, pagination, and page-size actions", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Search transactions"), {
      target: { value: "Maria" },
    });
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-09-01" },
    });
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-09-03" },
    });
    fireEvent.mouseDown(screen.getByLabelText("Transaction type"));
    fireEvent.click(screen.getByRole("option", { name: "Savings Deposit" }));

    expect(actions.updateFilters).toHaveBeenCalledWith({ search: "Maria" });
    expect(actions.updateFilters).toHaveBeenCalledWith({
      startDate: "2026-09-01",
    });
    expect(actions.updateFilters).toHaveBeenCalledWith({
      endDate: "2026-09-03",
    });
    expect(actions.updateFilters).toHaveBeenCalledWith({
      type: "savings_deposit",
    });

    fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
    expect(actions.setPage).toHaveBeenCalledWith(2);

    fireEvent.mouseDown(screen.getByLabelText("Rows per page"));
    fireEvent.click(screen.getByRole("option", { name: "50" }));
    expect(actions.setLimit).toHaveBeenCalledWith(50);
    expect(actions.setPage).toHaveBeenCalledWith(1);
  });

  it("preserves the cashier reversal request workflow", async () => {
    renderPage();

    expect(
      screen.getByRole("columnheader", { name: "Actions" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Request Reversal" }),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Request Reversal" }));
    const dialog = screen.getByRole("dialog", {
      name: "Request repayment reversal",
    });
    fireEvent.change(within(dialog).getByLabelText("Reason (optional)"), {
      target: { value: "Duplicate payment" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Submit Request" }),
    );

    await waitFor(() =>
      expect(requestReversalMock).toHaveBeenCalledWith(
        "repayment-1",
        "Duplicate payment",
      ),
    );
    await waitFor(() => expect(actions.refresh).toHaveBeenCalledOnce());
  });

  it.each(["manager", "loan processor"])(
    "omits the Actions column for the read-only %s role",
    (readOnlyRole) => {
      currentRole = readOnlyRole;
      renderPage();

      expect(
        screen.queryByRole("columnheader", { name: "Actions" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /reversal|reverse payment/i }),
      ).not.toBeInTheDocument();
    },
  );

  it("runs the immediate reversal action only for eligible admin rows", async () => {
    currentRole = "admin";
    renderPage();

    expect(
      screen.getByRole("columnheader", { name: "Actions" }),
    ).toBeInTheDocument();
    const reversePayment = screen.getByRole("button", {
      name: "Reverse Payment",
    });
    fireEvent.click(reversePayment);

    const dialog = screen.getByRole("dialog", { name: "Reverse repayment" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Reverse Payment" }),
    );

    await waitFor(() =>
      expect(requestReversalMock).toHaveBeenCalledWith(
        "repayment-1",
        undefined,
      ),
    );
    await waitFor(() => expect(actions.refresh).toHaveBeenCalledOnce());
  });

  it("uses the shared operational loading structure", () => {
    useTransactionHistoryMock.mockReturnValue({
      ...defaultState,
      transactions: [],
      loading: true,
    });

    renderPage();

    expect(
      screen.getByRole("status", { name: "Loading operational records" }),
    ).toBeInTheDocument();
  });

  it("separates request failures from successful empty states", () => {
    useTransactionHistoryMock.mockReturnValue({
      ...defaultState,
      transactions: [],
      total: 0,
      error: "Failed to load transactions",
    });
    const { rerender } = renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Failed to load transactions",
    );
    expect(
      screen.queryByText("No transaction history is available."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(actions.refresh).toHaveBeenCalledOnce();

    useTransactionHistoryMock.mockReturnValue({
      ...defaultState,
      transactions: [],
      total: 0,
      filters: { ...defaultState.filters, search: "missing" },
    });
    rerender(
      <ThemeProvider theme={theme}>
        <TransactionHistoryPage />
      </ThemeProvider>,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByText("No transactions match the selected filters."),
    ).toBeInTheDocument();
  });
});
