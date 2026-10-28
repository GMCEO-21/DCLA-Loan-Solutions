import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { theme } from "../../../theme/theme";
import collectionsService from "../api";
import savingsService from "@features/savings/api";
import type { DailyCollectionGroup, MemberWithLoans } from "../types";
import CollectionDetailsModal from "./CollectionDetailsModal";

const auth = vi.hoisted(() => ({ role: "cashier" }));

vi.mock("@features/auth/authStore", () => ({
  useAuthStore: (selector: (state: { user: { role: string } }) => unknown) =>
    selector({ user: { role: auth.role } }),
}));
vi.mock("@mui/icons-material", () => ({
  AccountBalanceWallet: () => <span aria-hidden="true" />,
  CalendarToday: () => <span aria-hidden="true" />,
  CheckCircle: () => <span aria-hidden="true" />,
  Close: () => <span aria-hidden="true" />,
  Download: () => <span aria-hidden="true" />,
  HourglassEmpty: () => <span aria-hidden="true" />,
  LocationOn: () => <span aria-hidden="true" />,
  Payments: () => <span aria-hidden="true" />,
  People: () => <span aria-hidden="true" />,
  PictureAsPdf: () => <span aria-hidden="true" />,
  RequestQuote: () => <span aria-hidden="true" />,
  Schedule: () => <span aria-hidden="true" />,
  Search: () => <span aria-hidden="true" />,
  Warning: () => <span aria-hidden="true" />,
}));
vi.mock("../api", () => ({
  default: {
    getCenterMembers: vi.fn(),
    getCenterCollectionsByDate: vi.fn(),
    getPendingRepaymentsForCollection: vi.fn(),
  },
}));
vi.mock("@features/savings/api", () => ({
  default: {
    getByMember: vi.fn(),
    getHistory: vi.fn(),
    deposit: vi.fn(),
    withdraw: vi.fn(),
  },
}));
vi.mock("./PaymentDialog", () => ({ PaymentDialog: () => null }));
vi.mock("./ReloanDialog", () => ({ ReloanDialog: () => null }));
vi.mock("@features/notifications/components/SendSmsConfirmationDialog", () => ({
  default: () => null,
}));

const member: MemberWithLoans = {
  id: "member-a",
  firstName: "Maria",
  lastName: "Santos",
  middleName: "",
  contactNumber: "09171234567",
  address: "North Center",
  createdAt: "2026-10-20T00:00:00Z",
  updatedAt: "2026-10-20T00:00:00Z",
  loans: [
    {
      id: "loan-a",
      status: "active",
      amount: 10000,
      balance: 9000,
      dueDate: "2027-01-01",
    },
  ],
  totalLoanAmount: 10000,
  totalBalance: 9000,
  totalSavings: 500,
  weeklyPaymentAmount: 500,
  weeklyPaid: false,
  weeklyHasAllocation: false,
};

const collectionGroup: DailyCollectionGroup = {
  centerId: "center-a",
  centerName: "North Center",
  collectionDay: "Tuesday",
  collectionDate: "2026-10-20",
  totalAmount: 500,
  totalReceived: 0,
  totalMembers: 1,
  pendingCollections: 1,
  collections: [],
};

function renderWorkspace() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, cacheTime: 0 } },
  });
  const onDataChanged = vi.fn();
  const workspace = (open: boolean) => (
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <CollectionDetailsModal
          open={open}
          collectionGroup={collectionGroup}
          onClose={vi.fn()}
          onDataChanged={onDataChanged}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
  return { ...render(workspace(true)), workspace, onDataChanged };
}

async function openSavings() {
  fireEvent.click(await screen.findByRole("button", { name: "Savings" }));
  const dialog = await screen.findByRole("dialog", { name: "Manage Savings" });
  await waitFor(() =>
    expect(within(dialog).getByLabelText("Deposit Amount")).toBeEnabled(),
  );
  return dialog;
}

describe("Cashier savings from Collections", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.role = "cashier";
    vi.mocked(collectionsService.getCenterMembers).mockResolvedValue([member]);
    vi.mocked(collectionsService.getCenterCollectionsByDate).mockResolvedValue(
      [],
    );
    vi.mocked(
      collectionsService.getPendingRepaymentsForCollection,
    ).mockResolvedValue([]);
    vi.mocked(savingsService.getByMember).mockResolvedValue({
      entries: [],
      totalDeposits: 500,
      currentSavings: 500,
      activeLoanSavings: 500,
      activeLoanId: "loan-a",
      hasActiveLoan: true,
    });
  });

  it.each(["cashier", "admin"])(
    "posts a deposit as %s to the selected loan and refreshes the savings balance",
    async (role) => {
      auth.role = role;
      const { onDataChanged } = renderWorkspace();
      const dialog = await openSavings();
      expect(savingsService.getByMember).toHaveBeenCalledWith("member-a");
      vi.mocked(savingsService.deposit).mockResolvedValue({
        loan: { id: "loan-a", savings: 600 },
      });
      vi.mocked(collectionsService.getCenterMembers).mockResolvedValue([
        { ...member, totalSavings: 600 },
      ]);

      fireEvent.change(within(dialog).getByLabelText("Deposit Amount"), {
        target: { value: "100" },
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Record deposit" }),
      );

      await waitFor(() => expect(onDataChanged).toHaveBeenCalledOnce());
      expect(savingsService.deposit).toHaveBeenCalledExactlyOnceWith({
        memberId: "member-a",
        loanId: "loan-a",
        amount: 100,
      });
      expect(savingsService.withdraw).not.toHaveBeenCalled();
      expect(collectionsService.getCenterMembers).toHaveBeenCalledTimes(2);
      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Manage Savings" }),
        ).not.toBeInTheDocument(),
      );
      expect(
        screen.getByText(/Savings transaction recorded successfully/),
      ).toBeInTheDocument();
      expect(screen.getByText(/600/)).toBeInTheDocument();
      expect(screen.getByText("UNPAID")).toBeInTheDocument();
    },
  );

  it("keeps a failed deposit open without refreshing or reporting success", async () => {
    vi.mocked(savingsService.deposit).mockRejectedValue(
      new Error("Deposit unavailable"),
    );
    const { onDataChanged } = renderWorkspace();
    const dialog = await openSavings();
    fireEvent.change(within(dialog).getByLabelText("Deposit Amount"), {
      target: { value: "100" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Record deposit" }),
    );

    expect(
      await within(dialog).findByText("Deposit unavailable"),
    ).toBeInTheDocument();
    expect(onDataChanged).not.toHaveBeenCalled();
    expect(collectionsService.getCenterMembers).toHaveBeenCalledOnce();
    expect(
      within(dialog).getByRole("button", { name: "Record deposit" }),
    ).toBeEnabled();
  });

  it.each(["manager", "loan processor", "superadmin"])(
    "does not expose savings posting to %s",
    async (role) => {
      auth.role = role;
      renderWorkspace();
      await screen.findByText("Maria Santos");
      expect(
        screen.queryByRole("button", { name: "Savings" }),
      ).not.toBeInTheDocument();
      expect(savingsService.getByMember).not.toHaveBeenCalled();
    },
  );

  it("blocks savings posting for ambiguous active loans", async () => {
    vi.mocked(collectionsService.getCenterMembers).mockResolvedValue([
      {
        ...member,
        loans: [...member.loans, { ...member.loans[0], id: "loan-b" }],
      },
    ]);
    renderWorkspace();
    expect(
      await screen.findByRole("button", { name: "Savings" }),
    ).toBeDisabled();
    expect(savingsService.getByMember).not.toHaveBeenCalled();
  });

  it("closes the savings dialog when its collection workspace closes", async () => {
    const { rerender, workspace } = renderWorkspace();
    await openSavings();
    rerender(workspace(false));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Manage Savings" }),
      ).not.toBeInTheDocument(),
    );
    rerender(workspace(true));
    await screen.findByRole("button", { name: "Savings" });
    expect(
      screen.queryByRole("dialog", { name: "Manage Savings" }),
    ).not.toBeInTheDocument();
  });
});
