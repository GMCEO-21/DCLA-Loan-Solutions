import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "../../../theme/theme";
import savingsService from "../api";
import type { SavingsHistoryResponse, SavingsHistoryScope } from "../types";
import SavingsHistoryDialog from "./SavingsHistoryDialog";

vi.mock("../api", () => ({
  default: { getHistory: vi.fn() },
}));

const member = { id: "member-a", firstName: "Evelyn", lastName: "Abordo" };
const money = (amount: number) =>
  `₱${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const ledgerResponse = (page = 1): SavingsHistoryResponse => ({
  scope: "ledger",
  items: [
    {
      recordClass: "ledger",
      id: `ledger-${page}`,
      eventType: page === 1 ? "manual_deposit" : "manual_withdrawal",
      amount: page === 1 ? "1000.00" : "-300.00",
      balanceBefore: page === 1 ? "4500.00" : "1000.00",
      balanceAfter: page === 1 ? "5500.00" : "700.00",
      businessDate: page === 1 ? "2026-09-03" : "2026-09-04",
      createdAt: "2026-09-03T02:35:00.000Z",
      remarks: null,
      loanId: "loan-a",
      performedBy: null,
      referenceType: page === 1 ? "manual_savings" : null,
      referenceId: "reference-a",
      reversalOfId: null,
    },
  ],
  pagination: { page, limit: 25, total: 26, totalPages: 2 },
});

const legacyResponse: SavingsHistoryResponse = {
  scope: "legacy",
  items: [
    {
      recordClass: "legacy",
      id: "legacy-credit",
      amount: "250.00",
      direction: "credit",
      createdAt: "2025-01-01T00:00:00.000Z",
      remarks: "Old savings entry",
    },
    {
      recordClass: "legacy",
      id: "legacy-unknown",
      amount: "0.00",
      direction: null,
      createdAt: "2025-01-02T00:00:00.000Z",
      remarks: null,
    },
  ],
  pagination: { page: 1, limit: 25, total: 2, totalPages: 1 },
};

function setViewport(width: number) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => {
      const maxWidth = /max-width:\s*([\d.]+)px/.exec(query);
      const minWidth = /min-width:\s*([\d.]+)px/.exec(query);
      return {
        matches:
          (!maxWidth || width <= Number(maxWidth[1])) &&
          (!minWidth || width >= Number(minWidth[1])),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    }),
  });
}

function renderHistory(width = 1200) {
  setViewport(width);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
  return {
    client,
    ...render(
      <SavingsHistoryDialog
        open
        member={member}
        currentSavings={5500}
        formatCurrency={money}
        onClose={vi.fn()}
      />,
      { wrapper },
    ),
  };
}

describe("SavingsHistoryDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(savingsService.getHistory).mockImplementation(
      async ({
        scope,
        page = 1,
      }: {
        scope: SavingsHistoryScope;
        page?: number;
      }) => (scope === "ledger" ? ledgerResponse(page) : legacyResponse),
    );
  });

  it("renders the authoritative balance and readable ledger audit fields", async () => {
    renderHistory();

    const dialog = screen.getByRole("dialog", { name: "Savings History" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveClass("MuiDialog-paperWidthFalse");
    expect(dialog).not.toHaveClass("MuiDialog-paperFullScreen");
    expect(screen.getByText("Abordo, Evelyn")).toBeInTheDocument();
    expect(screen.getByText("₱5,500.00")).toBeInTheDocument();
    expect(await screen.findByText("Deposit")).toBeInTheDocument();
    expect(screen.getByText("+₱1,000.00")).toBeInTheDocument();
    expect(screen.getByText("Sep 3, 2026")).toBeInTheDocument();
    expect(
      screen.getByText("₱5,500.00", { selector: "td" }),
    ).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Show details for Deposit" }),
    );
    expect(await screen.findByText("Balance Before")).toBeInTheDocument();
    expect(screen.getByText("Sep 3, 2026, 10:35 AM")).toBeInTheDocument();
    expect(screen.getByText("manual_savings")).toBeInTheDocument();
  });

  it("preserves full-screen geometry on mobile", () => {
    renderHistory(390);
    const dialog = screen.getByRole("dialog", { name: "Savings History" });
    const styles = getComputedStyle(dialog);

    expect(dialog).toHaveClass("MuiDialog-paperFullScreen");
    expect(styles.margin).toBe("0px");
    expect(styles.width).toBe("100%");
    expect(styles.maxWidth).toBe("100%");
    expect(styles.height).toBe("100%");
  });

  it("keeps ledger and legacy page state independent and semantically separate", async () => {
    renderHistory();
    await screen.findByText("Deposit");

    fireEvent.click(screen.getByRole("tab", { name: "Legacy Transactions" }));
    expect(
      await screen.findByText("Legacy Transactions (Pre-Ledger)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "These transactions were recorded before detailed savings ledger tracking was enabled.",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText("Credit")).toBeInTheDocument();
    expect(screen.getByText("+₱250.00")).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Balance After" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Performed By" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Savings Ledger" }));
    expect(await screen.findByText("Deposit")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Withdrawal")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("-₱300.00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Legacy Transactions" }));
    expect(await screen.findByText("Credit")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
  });

  it.each([
    [1200, "ledger-desktop"],
    [800, "ledger-mobile"],
    [390, "ledger-mobile"],
  ])(
    "uses a usable responsive history layout at %ipx",
    async (width, testId) => {
      renderHistory(width);
      expect(await screen.findByTestId(testId)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Close savings history" }),
      ).toBeEnabled();
      expect(document.body.scrollWidth).toBeLessThanOrEqual(
        document.body.clientWidth,
      );
    },
  );

  it("renders the expected pre-cutover empty ledger state", async () => {
    vi.mocked(savingsService.getHistory).mockResolvedValue({
      scope: "ledger",
      items: [],
      pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
    });
    renderHistory();

    expect(
      await screen.findByText("No savings ledger transactions yet."),
    ).toBeInTheDocument();
    expect(screen.getByText("₱5,500.00")).toBeInTheDocument();
  });
});
