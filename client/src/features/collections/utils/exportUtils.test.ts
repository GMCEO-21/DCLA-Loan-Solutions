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

describe("Collections export weekly status", () => {
  beforeEach(() => vi.spyOn(console, "log").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ["funded week", "PAID", 0],
    ["unfunded next week", "UNPAID", 1500],
    ["partially funded next week", "PARTIAL", 1500],
  ])(
    "writes the UI status for a %s without changing financial cells",
    async (_case, label, amountPaid) => {
      const group = {
        centerId: "center-1",
        centerName: "North Center",
        collectionDay: "Tuesday",
        collectionDate: "2026-10-20",
        totalMembers: 1,
        collections: [{ id: "collection-1", paymentReceived: 500 }],
      } as DailyCollectionGroup;
      const member = {
        id: "member-1",
        firstName: "Maria",
        lastName: "Santos",
        totalLoanAmount: 3000,
        totalBalance: 1500,
        weeklyPaymentAmount: 1500,
        loans: [{ id: "loan-1", status: "active", amountPaid }],
        collection: { paymentReceived: 500 },
        __computed: { status: { label } },
      } as unknown as MemberWithLoans;
      workbookWrite.mockReturnValue(new Uint8Array());

      await exportAllCollectionsToExcel([{ group, members: [member] }]);

      const workbook = workbookWrite.mock.calls.at(
        -1,
      )?.[0] as import("xlsx").WorkBook;
      const sheet = workbook.Sheets["North Center"];
      expect(sheet).toBeDefined();
      expect(sheet.M8.v).toBe(label);
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
        header: 1,
      });
      expect(rows.find((row) => row[0] === "Paid Members")?.[1]).toBe(
        label === "PAID" ? 1 : 0,
      );
      expect(
        rows.find((row) => row[0] === "Partial Payment Members")?.[1],
      ).toBe(label === "PARTIAL" ? 1 : 0);
      expect(rows.find((row) => row[0] === "Unpaid Members")?.[1]).toBe(
        label === "UNPAID" ? 1 : 0,
      );
      expect(sheet.D8.v).toBe("₱3,000");
      expect(sheet.L8.v).toBe("₱1,500");
    },
  );
});
