import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import type { DailyCollectionGroup, MemberWithLoans } from "../types";
import { exportAllCollectionsToExcel } from "./exportUtils";

const workbookWrite = vi.hoisted(() => vi.fn());
vi.mock("xlsx", async (importOriginal) => {
  const original = await importOriginal<typeof import("xlsx")>();
  return { ...original, write: workbookWrite };
});
vi.mock("file-saver", () => ({ saveAs: vi.fn() }));

const group = (overrides: Partial<DailyCollectionGroup> = {}) =>
  ({
    centerId: "center-1",
    centerName: "North Center",
    collectionDay: "Tuesday",
    collectionDate: "2026-10-20",
    totalMembers: 48,
    totalAmount: 0,
    totalReceived: 1200,
    pendingCollections: 0,
    collections: [],
    ...overrides,
  }) as DailyCollectionGroup;

type ExportTestMemberOverrides = Partial<MemberWithLoans> & {
  __computed?: { status: { label: string } };
};

const member = (
  id: string,
  due: number,
  applied: number,
  overrides: ExportTestMemberOverrides = {},
) =>
  ({
    id,
    firstName: "Maria",
    middleName: "",
    lastName: `Santos ${id}`,
    contactNumber: "09170000000",
    loans: [
      {
        id: `${id}-loan`,
        status: "active",
        amount: 3000,
        amountPaid: 999999,
      },
    ],
    totalLoanAmount: 3000,
    overallAmount: 3600,
    totalTermWeeks: 12,
    totalSavings: 100,
    totalBalance: 1500,
    weeklyPaymentAmount: 999999,
    netCashReleasedForDate: 8000,
    collection: { paymentReceived: 999999 },
    weeklyFinancial: {
      kind: "scheduled_week",
      amountDue: due,
      amountApplied: applied,
      postMaturityLoanCount: 0,
      incompleteScheduleLoanCount: 0,
    },
    __computed: { status: { label: "PARTIAL" } },
    ...overrides,
  }) as unknown as MemberWithLoans;

const getWorkbook = () =>
  workbookWrite.mock.calls.at(-1)?.[0] as import("xlsx").WorkBook;

const getRows = (sheetName: string) =>
  XLSX.utils.sheet_to_json<(string | number)[]>(
    getWorkbook().Sheets[sheetName],
    { header: 1 },
  );

const valueFor = (rows: (string | number)[][], label: string) =>
  rows.find((row) => row[0] === label)?.[1];

describe("Collections Excel export parity", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    workbookWrite.mockReset().mockReturnValue(new Uint8Array());
  });
  afterEach(() => vi.restoreAllMocks());

  it("exports the Daily summary from backend collected, weekly, and exact-date release values", async () => {
    const dailyMember = member("member-1", 1500, 500, {
      loanCondition: { status: "past_due" },
      __computed: { status: { label: "PENDING" } },
    });

    await exportAllCollectionsToExcel(
      [{ group: group(), members: [dailyMember] }],
      "Daily_Collections",
      "daily",
    );

    const summaryRows = getRows("Summary");
    expect(valueFor(summaryRows, "Collected Today")).toBe("₱1,200");
    expect(valueFor(summaryRows, "Weekly Remaining")).toBe("₱1,000");
    expect(valueFor(summaryRows, "Released Today")).toBe("₱8,000");
    expect(valueFor(summaryRows, "Total Collected")).toBeUndefined();

    const rows = getRows("North Center");
    expect(valueFor(rows, "Number of Clients")).toBe(1);
    expect(valueFor(rows, "Pending Members")).toBe(1);
    const detailRow = rows[7];
    expect(detailRow[6]).toBe("₱1,500");
    expect(detailRow[7]).toBe("₱500");
    expect(detailRow[8]).toBe("₱1,000");
    expect(detailRow[9]).toBe("₱8,000");
    expect(detailRow[13]).toBe("PENDING");
    expect(detailRow[14]).toBe("Past Due");
    expect(rows.flat()).not.toContain("₱999,999");
  });

  it("exports a separate By-Date weekly summary and zero obligation for Past Maturity", async () => {
    const scheduled = member("member-1", 1500, 1500, {
      __computed: { status: { label: "PAID" } },
    });
    const partial = member("member-2", 1000, 400);
    const postMaturity = member("member-3", 0, 0, {
      weeklyFinancial: {
        kind: "post_maturity_no_weekly_obligation",
        amountDue: null,
        amountApplied: null,
        postMaturityLoanCount: 1,
        incompleteScheduleLoanCount: 0,
      },
      loanCondition: { status: "past_maturity" },
      __computed: { status: { label: "UNPAID" } },
    });

    await exportAllCollectionsToExcel(
      [{ group: group(), members: [scheduled, partial, postMaturity] }],
      "Collections_By_Date",
      "by-date",
    );

    const summaryRows = getRows("Summary");
    expect(valueFor(summaryRows, "Weekly Due")).toBe("₱2,500");
    expect(valueFor(summaryRows, "Applied to Week")).toBe("₱1,900");
    expect(valueFor(summaryRows, "Weekly Remaining")).toBe("₱600");
    expect(valueFor(summaryRows, "Collected Today")).toBeUndefined();

    const rows = getRows("North Center");
    const allPastMaturityRows = rows.filter(
      (row) => row[14] === "Past Maturity",
    );
    expect(allPastMaturityRows).toHaveLength(1);
    expect(allPastMaturityRows[0].slice(6, 9)).toEqual(["₱0", "₱0", "₱0"]);
  });

  it("renders unavailable weekly projections safely", async () => {
    const unavailable = member("member-1", 0, 0, {
      weeklyFinancial: {
        kind: "historical_funding_unavailable",
        amountDue: null,
        amountApplied: null,
        postMaturityLoanCount: 0,
        incompleteScheduleLoanCount: 0,
      },
      loanCondition: { status: "indeterminate" },
    });

    await exportAllCollectionsToExcel(
      [{ group: group(), members: [unavailable] }],
      "Collections_By_Date",
      "by-date",
    );

    const summaryRows = getRows("Summary");
    expect(valueFor(summaryRows, "Weekly Due")).toBe("Not available");
    expect(valueFor(summaryRows, "Applied to Week")).toBe("Not available");
    expect(valueFor(summaryRows, "Weekly Remaining")).toBe("Not available");
    const detailRow = getRows("North Center")[7];
    expect(detailRow.slice(6, 9)).toEqual([
      "Not available",
      "Not available",
      "Not available",
    ]);
    expect(detailRow[14] ?? "").toBe("");
  });
});
