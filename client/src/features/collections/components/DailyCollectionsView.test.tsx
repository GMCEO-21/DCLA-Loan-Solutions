import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it, vi } from "vitest";
import { theme } from "../../../theme/theme";
import DailyCollectionsView from "./DailyCollectionsView";
import { formatCollectionDatasetDate } from "../utils/date";
import type { DailyCollectionGroup } from "../types";

const getCenterMembers = vi.hoisted(() => vi.fn());
const getPendingRepaymentsForCollection = vi.hoisted(() => vi.fn());
const exportAllCollectionsToExcel = vi.hoisted(() => vi.fn());

vi.mock("../api", () => ({
  default: { getCenterMembers, getPendingRepaymentsForCollection },
}));
vi.mock("../utils/exportUtils", () => ({ exportAllCollectionsToExcel }));
vi.mock("@mui/icons-material", () => ({
  CalendarToday: () => <span aria-hidden="true" />,
  LocationOn: () => <span aria-hidden="true" />,
  People: () => <span aria-hidden="true" />,
  CheckCircle: () => <span aria-hidden="true" />,
  Schedule: () => <span aria-hidden="true" />,
  Warning: () => <span aria-hidden="true" />,
  HourglassEmpty: () => <span aria-hidden="true" />,
  Visibility: () => <span aria-hidden="true" />,
  FileDownload: () => <span aria-hidden="true" />,
}));

describe("formatCollectionDatasetDate", () => {
  it("formats a dataset calendar date without timezone shifting", () => {
    expect(formatCollectionDatasetDate("2026-09-07")).toBe("Sep 7, 2026");
    expect(formatCollectionDatasetDate("2026-09-03")).toBe("Sep 3, 2026");
  });

  it("preserves an invalid dataset date for diagnosis", () => {
    expect(formatCollectionDatasetDate("not-a-date")).toBe("not-a-date");
  });
});

describe("DailyCollectionsView weekly operational Paid", () => {
  it("counts an included funded member as Paid and exports the same status without changing amounts", async () => {
    const member = {
      id: "member-1",
      firstName: "Maria",
      lastName: "Santos",
      loans: [{ id: "loan-1", status: "active", amount: 3000, amountPaid: 0 }],
      totalLoanAmount: 3000,
      totalBalance: 3000,
      weeklyPaymentAmount: 1500,
      weeklyPaid: true,
    };
    const collection = {
      id: "collection-1",
      memberId: member.id,
      centerId: "center-1",
      paymentReceived: 0,
      amount: 1500,
      collectionDate: "2026-10-20",
    };
    const group = {
      centerId: "center-1",
      centerName: "North Center",
      collectionDay: "Tuesday",
      collectionDate: "2026-10-20",
      totalAmount: 1500,
      totalReceived: 0,
      totalMembers: 1,
      pendingCollections: 0,
      collections: [collection],
    } as unknown as DailyCollectionGroup;
    getCenterMembers.mockResolvedValue([member]);
    getPendingRepaymentsForCollection.mockResolvedValue([]);
    exportAllCollectionsToExcel.mockResolvedValue(undefined);

    render(
      <ThemeProvider theme={theme}>
        <DailyCollectionsView
          data={[group]}
          datasetDate="2026-10-20"
          onViewDetails={vi.fn()}
        />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("Paid").parentElement).toHaveTextContent("1"),
    );
    expect(screen.getByText("Total Members").parentElement).toHaveTextContent(
      "1",
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Export Current Results/i }),
    );
    await waitFor(() =>
      expect(exportAllCollectionsToExcel).toHaveBeenCalledOnce(),
    );
    const exportedMember =
      exportAllCollectionsToExcel.mock.calls[0][0][0].members[0];
    expect(exportedMember.id).toBe(member.id);
    expect(exportedMember.__computed.status.label).toBe("PAID");
    expect(exportedMember.totalBalance).toBe(3000);
    expect(exportedMember.collection.paymentReceived).toBe(0);
  });
});
