import type { ReactNode } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "../../../theme/theme";
import savingsService from "../api";
import SavingsDepositDialog from "./SavingsDepositDialog";

vi.mock("../api", () => ({
  default: {
    getByMember: vi.fn(),
    getHistory: vi.fn(),
    deposit: vi.fn(),
    withdraw: vi.fn(),
  },
}));

const member = { id: "member-a", firstName: "Evelyn", lastName: "Abordo" };
const savingsSummary = (
  overrides: Partial<{
    currentSavings: number;
    activeLoanId: string | null;
    hasActiveLoan: boolean;
    activeLoanSavings: number;
  }> = {},
) => ({
  entries: [],
  totalDeposits: 0,
  currentSavings: 5000,
  activeLoanId: "loan-a" as string | null,
  hasActiveLoan: true,
  activeLoanSavings: 5000,
  ...overrides,
});
const money = (amount: number) => `₱${amount.toFixed(2)}`;

function renderDialog(onSuccess = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
  return {
    onSuccess,
    ...render(
      <SavingsDepositDialog
        open
        member={member}
        onClose={vi.fn()}
        onSuccess={onSuccess}
        formatCurrency={money}
      />,
      { wrapper },
    ),
  };
}

async function openAndCloseHistory() {
  const historyButton = await screen.findByRole("button", {
    name: "View Savings History",
  });
  await waitFor(() => expect(historyButton).toBeEnabled());
  fireEvent.click(historyButton);
  expect(
    await screen.findByRole("dialog", { name: "Savings History" }),
  ).toBeInTheDocument();
  await screen.findByText("No savings ledger transactions yet.");
  fireEvent.click(
    screen.getByRole("button", { name: "Close savings history" }),
  );
  await waitFor(() => {
    expect(
      screen.queryByRole("dialog", { name: "Savings History" }),
    ).not.toBeInTheDocument();
  });
  expect(
    await screen.findByRole("dialog", { name: /Manage Savings/ }),
  ).toBeInTheDocument();
}

describe("SavingsDepositDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(savingsService.getByMember).mockResolvedValue(savingsSummary());
    vi.mocked(savingsService.getHistory).mockResolvedValue({
      scope: "ledger",
      items: [],
      pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
    });
  });

  it("retains the transaction modal and opens history from the balance area", async () => {
    renderDialog();
    const dialog = screen.getByRole("dialog", { name: "Manage Savings" });
    expect(dialog).toHaveStyle({
      width: "calc(100% - 32px)",
      maxWidth: "640px",
    });
    expect(
      screen.getByRole("button", { name: "Close savings form" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("₱5000.00")).toBeInTheDocument();

    await openAndCloseHistory();
    expect(savingsService.getHistory).toHaveBeenCalledWith({
      memberId: "member-a",
      scope: "ledger",
      page: 1,
      limit: 25,
    });
  });

  it("records a deposit, refreshes the balance, and refetches invalidated history", async () => {
    vi.mocked(savingsService.deposit).mockResolvedValue({
      loan: { id: "loan-a", savings: 6000 },
    });
    const { onSuccess } = renderDialog();
    await openAndCloseHistory();
    expect(savingsService.getHistory).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Deposit Amount"), {
      target: { value: "1000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record deposit" }));

    await waitFor(() =>
      expect(savingsService.deposit).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(
      screen.getByRole("heading", { level: 4, name: "₱6000.00" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "View Savings History" }),
    );
    await waitFor(() =>
      expect(savingsService.getHistory).toHaveBeenCalledTimes(2),
    );
  });

  it("records a withdrawal and refetches invalidated member history", async () => {
    vi.mocked(savingsService.withdraw).mockResolvedValue({
      loan: { id: "loan-a", savings: 4700 },
    });
    const { onSuccess } = renderDialog();
    await openAndCloseHistory();

    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    fireEvent.change(screen.getByLabelText("Withdrawal Amount"), {
      target: { value: "300" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record withdrawal" }));

    await waitFor(() =>
      expect(savingsService.withdraw).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(
      screen.getByRole("heading", { level: 4, name: "₱4700.00" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "View Savings History" }),
    );
    await waitFor(() =>
      expect(savingsService.getHistory).toHaveBeenCalledTimes(2),
    );
  });

  it("shows retained historical savings while keeping mutations unavailable and history accessible", async () => {
    vi.mocked(savingsService.getByMember).mockResolvedValue(
      savingsSummary({
        currentSavings: 3500,
        activeLoanId: null,
        hasActiveLoan: false,
        activeLoanSavings: 0,
      }),
    );
    renderDialog();

    expect(
      await screen.findByRole("heading", { level: 4, name: money(3500) }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deposit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Record deposit" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Savings transactions require an active loan/),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "View Savings History" }),
    );
    const historyDialog = await screen.findByRole("dialog", {
      name: "Savings History",
    });
    expect(historyDialog).toBeInTheDocument();
    expect(within(historyDialog).getByText(money(3500))).toBeInTheDocument();
  });

  it("shows zero and keeps mutations unavailable when the member has no loans", async () => {
    vi.mocked(savingsService.getByMember).mockResolvedValue(
      savingsSummary({
        currentSavings: 0,
        activeLoanId: null,
        hasActiveLoan: false,
        activeLoanSavings: 0,
      }),
    );
    renderDialog();

    expect(
      await screen.findByRole("heading", { level: 4, name: money(0) }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deposit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "View Savings History" }),
    ).toBeEnabled();
  });
});
