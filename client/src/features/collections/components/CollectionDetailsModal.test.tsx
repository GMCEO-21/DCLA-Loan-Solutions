import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { theme } from "../../../theme/theme";
import CollectionDetailsModal from "./CollectionDetailsModal";

const getCenterMembers = vi.hoisted(() => vi.fn());
const getCenterCollectionsByDate = vi.hoisted(() => vi.fn());
const getPendingRepaymentsForCollection = vi.hoisted(() => vi.fn());
const exportToExcel = vi.hoisted(() => vi.fn());

vi.mock("../utils/exportUtils", () => ({ exportToExcel }));

vi.mock("../api", () => ({
  default: {
    getCenterMembers,
    getCenterCollectionsByDate,
    getPendingRepaymentsForCollection,
  },
}));
vi.mock("@features/auth/authStore", () => ({
  useAuthStore: (selector: (state: { user: { role: string } }) => unknown) =>
    selector({ user: { role: "admin" } }),
}));
vi.mock("@mui/icons-material", () => ({
  CalendarToday: () => <span aria-hidden="true" />,
  CheckCircle: () => <span aria-hidden="true" />,
  Close: () => <span aria-hidden="true" />,
  Download: () => <span aria-hidden="true" />,
  LocationOn: () => <span aria-hidden="true" />,
  People: () => <span aria-hidden="true" />,
  PictureAsPdf: () => <span aria-hidden="true" />,
  Search: () => <span aria-hidden="true" />,
}));
vi.mock("./CollectionSummaryCards", () => ({
  CollectionSummaryCards: () => <div>Collection summary</div>,
}));
vi.mock("./MembersTable", () => ({
  MembersTable: ({
    members,
    getStatusLabel,
    getCollectionMetrics,
  }: {
    members: Array<{ id: string }>;
    getStatusLabel: (member: { id: string }) => string;
    getCollectionMetrics: (member: { id: string }) => { received: number };
  }) => (
    <div>
      {members.map((member) => (
        <span key={member.id}>
          {member.id}:{getStatusLabel(member)}:
          {getCollectionMetrics(member).received}
        </span>
      ))}
    </div>
  ),
}));
vi.mock("./PaymentDialog", () => ({ PaymentDialog: () => null }));
vi.mock("./ReloanDialog", () => ({ ReloanDialog: () => null }));
vi.mock("@features/notifications/components/SendSmsConfirmationDialog", () => ({
  default: () => null,
}));

describe("CollectionDetailsModal", () => {
  beforeEach(() => {
    getCenterMembers.mockResolvedValue([]);
    getCenterCollectionsByDate.mockResolvedValue([]);
    getPendingRepaymentsForCollection.mockResolvedValue([]);
  });

  it("uses the local collection workspace width", async () => {
    render(
      <ThemeProvider theme={theme}>
        <CollectionDetailsModal
          open
          collectionGroup={{
            centerId: "center-1",
            centerName: "North Center",
            collectionDay: "Monday",
            collectionDate: "2026-09-07",
            totalAmount: 0,
            totalReceived: 0,
            totalMembers: 0,
            pendingCollections: 0,
            collections: [],
          }}
          onClose={vi.fn()}
        />
      </ThemeProvider>,
    );

    const dialog = screen.getByRole("dialog", { name: /North Center/ });
    expect(dialog).toHaveClass("MuiDialog-paperWidthFalse");
    expect(getComputedStyle(dialog).width).toBe("calc(100% - 32px)");
    expect(getComputedStyle(dialog).maxWidth).toBe("1100px");
    await waitFor(() => expect(getCenterMembers).toHaveBeenCalledOnce());
  });

  it("shows weekly Paid and exports the same status without changing member rows or received", async () => {
    getCenterMembers.mockResolvedValue([
      {
        id: "member-1",
        firstName: "Maria",
        lastName: "Santos",
        loans: [
          { id: "loan-1", status: "active", amount: 3000, amountPaid: 0 },
        ],
        totalLoanAmount: 3000,
        totalBalance: 3000,
        weeklyPaymentAmount: 1500,
        weeklyPaid: true,
      },
    ]);
    getCenterCollectionsByDate.mockResolvedValue([
      {
        id: "collection-1",
        memberId: "member-1",
        centerId: "center-1",
        collectionDate: "2026-10-20",
        amount: 1500,
        paymentReceived: 0,
      },
    ]);
    exportToExcel.mockResolvedValue(undefined);

    render(
      <ThemeProvider theme={theme}>
        <CollectionDetailsModal
          open
          collectionGroup={{
            centerId: "center-1",
            centerName: "North Center",
            collectionDay: "Tuesday",
            collectionDate: "2026-10-20",
            totalAmount: 1500,
            totalReceived: 0,
            totalMembers: 1,
            pendingCollections: 0,
            collections: [],
          }}
          onClose={vi.fn()}
        />
      </ThemeProvider>,
    );

    expect(await screen.findByText("member-1:PAID:0")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Export collection details to Excel",
      }),
    );
    await waitFor(() => expect(exportToExcel).toHaveBeenCalledOnce());
    const exportedMembers = exportToExcel.mock.calls[0][1];
    expect(exportedMembers).toHaveLength(1);
    expect(exportedMembers[0].id).toBe("member-1");
    expect(exportedMembers[0].__computed.status.label).toBe("PAID");
    expect(exportedMembers[0].__computed.collectionMetrics.received).toBe(0);
    expect(exportedMembers[0].totalBalance).toBe(3000);
  });

  it("preserves the legacy status when the weekly projection is missing", async () => {
    getCenterMembers.mockResolvedValue([
      {
        id: "member-2",
        firstName: "Ana",
        lastName: "Reyes",
        loans: [
          {
            id: "loan-2",
            status: "active",
            amount: 3000,
            amountPaid: 500,
            weeklyPaymentAmount: 1500,
            loanCreatedDate: "2026-10-17",
          },
        ],
        totalLoanAmount: 3000,
        totalBalance: 2500,
        weeklyPaymentAmount: 1500,
        weeklyPaid: null,
      },
    ]);
    getCenterCollectionsByDate.mockResolvedValue([
      {
        id: "collection-2",
        memberId: "member-2",
        centerId: "center-1",
        collectionDate: "2026-10-20",
        amount: 1500,
        paymentReceived: 0,
      },
    ]);

    render(
      <ThemeProvider theme={theme}>
        <CollectionDetailsModal
          open
          collectionGroup={{
            centerId: "center-1",
            centerName: "North Center",
            collectionDay: "Tuesday",
            collectionDate: "2026-10-20",
            totalAmount: 1500,
            totalReceived: 0,
            totalMembers: 1,
            pendingCollections: 0,
            collections: [],
          }}
          onClose={vi.fn()}
        />
      </ThemeProvider>,
    );

    expect(await screen.findByText("member-2:PARTIAL:0")).toBeInTheDocument();
    expect(screen.queryByText(/Unavailable/i)).not.toBeInTheDocument();
  });

  it("shows the operational member count and keeps it stable while searching", async () => {
    const activeMembers = Array.from({ length: 11 }, (_, index) => ({
      id: index < 2 ? `match-${index}` : `other-${index}`,
      firstName: index < 2 ? "SearchMatch" : "Different",
      lastName: `Member ${index}`,
      loans: [{ id: `loan-${index}`, status: "active" }],
      weeklyPaid: false,
      weeklyHasAllocation: false,
    }));
    getCenterMembers.mockResolvedValue([
      ...activeMembers,
      { id: "no-loan", firstName: "No", lastName: "Loan", loans: [] },
      {
        id: "closed-only",
        firstName: "Closed",
        lastName: "Only",
        loans: [{ id: "closed-loan", status: "closed" }],
      },
      {
        id: "inactive-only",
        firstName: "Inactive",
        lastName: "Only",
        loans: [{ id: "inactive-loan", status: "inactive" }],
      },
    ]);

    render(
      <ThemeProvider theme={theme}>
        <CollectionDetailsModal
          open
          collectionGroup={{
            centerId: "center-1",
            centerName: "North Center",
            collectionDay: "Tuesday",
            collectionDate: "2026-10-20",
            totalAmount: 0,
            totalReceived: 0,
            totalMembers: 48,
            pendingCollections: 0,
            collections: [],
          }}
          onClose={vi.fn()}
        />
      </ThemeProvider>,
    );

    expect(await screen.findByText("11 Members")).toBeInTheDocument();
    expect(screen.getByText(/^match-0:/)).toBeInTheDocument();
    expect(screen.getByText(/^other-2:/)).toBeInTheDocument();
    expect(screen.queryByText(/^no-loan:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^closed-only:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^inactive-only:/)).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText("Search member by name or contact"),
      { target: { value: "SearchMatch" } },
    );

    await waitFor(() =>
      expect(screen.queryByText(/^other-2:/)).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/^match-0:/)).toBeInTheDocument();
    expect(screen.getByText(/^match-1:/)).toBeInTheDocument();
    expect(screen.getByText("11 Members")).toBeInTheDocument();
  });
});
