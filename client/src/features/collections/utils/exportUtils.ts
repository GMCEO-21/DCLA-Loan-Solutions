import type {
  DailyCollectionGroup,
  MemberWithLoans,
  Collection,
} from "../types";
import type { ColInfo, Range, WorkSheet } from "xlsx";
import {
  hasActiveLoan,
  hasLoanAmount,
  evaluateMemberStatus,
  getOperationalCollectionStatus,
} from "./memberStatus";
import {
  combineWeeklyFinancialSummaries,
  getWeeklyFinancialSummary,
} from "./weeklySummary";

export type CollectionExportMode = "daily" | "by-date";

type MemberExportComputed = {
  paymentInfo: {
    weeklyDue: number;
    shortfall: number;
    totalPaid: number;
    weeksCovered: number;
  };
  collectionMetrics: {
    received: number;
    due: number;
    weeklyDue?: number;
    weeksCovered?: number;
  };
  status: {
    label: string;
    color: string;
  };
};

type MemberLoanLike = MemberWithLoans["loans"][number] & {
  status?: string;
  amountPaid?: number;
  weeksPaid?: number;
  weeklyPaymentAmount?: number;
  termWeeks?: number;
  principalAmount?: number;
  totalAmount?: number;
  netCashReleased?: number;
};

type CollectionWithReceived = Collection & {
  amountReceived?: number;
};

type ExportableMemberExtended = Omit<MemberWithLoans, "loans"> & {
  loans: MemberLoanLike[];
  netCashReleasedForDate?: number;
  collection?: CollectionWithReceived;
  __computed?: MemberExportComputed;
};

type WorksheetWithMeta = WorkSheet & {
  "!merges"?: Range[];
  "!cols"?: ColInfo[];
};

const asExportable = (member: MemberWithLoans): ExportableMemberExtended =>
  member as ExportableMemberExtended;

const getNetReleaseValue = (member: ExportableMemberExtended): number => {
  const value =
    member.netCashReleasedForDate ??
    member.netCashReleased ??
    member.collection?.netRelease ??
    0;
  return Number(value) || 0;
};

// Types for batch export
export type CollectionExportBundle = {
  group: DailyCollectionGroup;
  members: MemberWithLoans[];
};

const getExportStatusLabel = (
  member: MemberWithLoans,
  collectionDate: string,
): string => {
  const enriched = asExportable(member);
  if (enriched.__computed?.status?.label) {
    return enriched.__computed.status.label;
  }

  return getOperationalCollectionStatus(
    member,
    evaluateMemberStatus(member, {
      collection: member.collection,
      referenceDate: collectionDate,
    }),
  ).label;
};

const getLoanConditionLabel = (member: MemberWithLoans): string => {
  if (member.loanCondition?.status === "past_due") return "Past Due";
  if (member.loanCondition?.status === "past_maturity") {
    return "Past Maturity";
  }
  return "";
};

const formatCurrencyCell = (value: number): string =>
  `₱${value.toLocaleString()}`;

const formatWeeklyCell = (
  summary: ReturnType<typeof getWeeklyFinancialSummary>,
  value: number | undefined,
): string => {
  if (!summary?.available || value === undefined) return "Not available";
  return formatCurrencyCell(value);
};

// Fallback CSV export function
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const exportToCSV = (
  collectionGroup: DailyCollectionGroup,
  members: MemberWithLoans[],
): void => {
  try {
    // Create CSV content
    const csvContent = [
      // Summary section
      "Collection Report Summary",
      "",
      "Center Information",
      `Center Name,${collectionGroup.centerName}`,
      `Collection Day,${collectionGroup.collectionDay}`,
      `Collection Date,${collectionGroup.collectionDate}`,
      `Total Members,${collectionGroup.totalMembers}`,
      "",
      "Financial Summary",
      `Total Amount Expected,₱${collectionGroup.totalAmount.toLocaleString()}`,
      `Total Amount Received,₱${(collectionGroup.collections || [])
        .reduce((sum, c: CollectionWithReceived) => {
          const received = c?.amountReceived ?? c?.paymentReceived ?? 0;
          return sum + (Number(received) || 0);
        }, 0)
        .toLocaleString()}`,
      `Total Remaining Balance,₱${(
        collectionGroup.totalAmount - collectionGroup.totalReceived
      ).toLocaleString()}`,
      `Pending Collections,${collectionGroup.pendingCollections}`,
      "",
      "Status Breakdown",
      `Paid Collections,${
        collectionGroup.collections.filter((c: CollectionWithReceived) => {
          const received = Number(c?.amountReceived ?? c?.paymentReceived ?? 0);
          return received >= Number(c.amount || 0);
        }).length
      }`,
      `Partial Collections,${
        collectionGroup.collections.filter((c: CollectionWithReceived) => {
          const received = Number(c?.amountReceived ?? c?.paymentReceived ?? 0);
          return received > 0 && received < Number(c.amount || 0);
        }).length
      }`,
      `Pending Collections,${
        collectionGroup.collections.filter((c: CollectionWithReceived) => {
          const received = Number(c?.amountReceived ?? c?.paymentReceived ?? 0);
          return received <= 0;
        }).length
      }`,
      "",
      // Members detail section
      "Members Detail",
      "Member Name,Contact Number,Address,Overall Amount,Term Weeks,Net Cash Released,No. of Payments,Savings,Remaining Balance,Weekly Payment,Payment Status,Notes",
      ...members.map((member) =>
        [
          `${member.firstName} ${member.lastName}`,
          member.contactNumber || "-",
          member.address || "-",
          `₱${member.overallAmount?.toLocaleString() || "0"}`,
          member.totalTermWeeks || "-",
          `₱${getNetReleaseValue(member).toLocaleString()}`,
          member.numberOfPayments || "0",
          `₱${member.totalSavings?.toLocaleString() || "0"}`,
          `₱${member.totalBalance?.toLocaleString() || "0"}`,
          `₱${member.weeklyPaymentAmount?.toLocaleString() || "0"}`,
          (member.collection?.paymentReceived || 0) >=
          (member.weeklyPaymentAmount || 0)
            ? "PAID"
            : "PENDING",
          member.collection?.notes || "-",
        ].join(","),
      ),
      "",
      // Collections detail section
      "Collections Detail",
      "Member Name,Collection Date,Amount Expected,Amount Received,Balance,Status,Notes,Auto Generated",
      ...collectionGroup.collections.map((collection: CollectionWithReceived) =>
        [
          `${collection.member?.firstName || ""} ${
            collection.member?.lastName || ""
          }`,
          collection.collectionDate,
          `₱${collection.amount.toLocaleString()}`,
          `₱${(
            Number(
              collection.amountReceived ?? collection.paymentReceived ?? 0,
            ) || 0
          ).toLocaleString()}`,
          `₱${(
            Number(collection.amount || 0) -
            (Number(
              collection.amountReceived ?? collection.paymentReceived ?? 0,
            ) || 0)
          ).toLocaleString()}`,
          (Number(
            collection.amountReceived ?? collection.paymentReceived ?? 0,
          ) || 0) >= Number(collection.amount || 0)
            ? "PAID"
            : (Number(
                  collection.amountReceived ?? collection.paymentReceived ?? 0,
                ) || 0) > 0
              ? "PARTIAL"
              : "PENDING",
          collection.notes || "-",
          collection.isAutoGenerated ? "Yes" : "No",
        ].join(","),
      ),
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Collection_Report_${
        collectionGroup.centerName
      }_${collectionGroup.collectionDate.replace(/-/g, "_")}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("CSV export failed:", error);
    throw new Error("Failed to export collection data as CSV.");
  }
};

// Helper: build the single-sheet data structure for a group
const buildGroupSheetData = (
  collectionGroup: DailyCollectionGroup,
  members: MemberWithLoans[],
  mode: CollectionExportMode = "daily",
): {
  data: (string | number)[][];
  merges: { s: { r: number; c: number }; e: { r: number; c: number } }[];
} => {
  const sheetData: (string | number)[][] = [];

  const getMemberWeeksPaid = (member: ExportableMemberExtended): number => {
    const m = asExportable(member);
    const activeLoan = (m?.loans || []).find((l) => l?.status === "active");
    const weeksPaid =
      activeLoan?.weeksPaid ?? m?.collection?.numberOfPayments ?? 0;
    return Number(weeksPaid) || 0;
  };
  // Title rows
  sheetData.push(["DYNAMIC CREDIT AND LOAN SOLUTIONS (DCLA)"]);
  sheetData.push(["GROUP COLLECTION REPORT"]);
  sheetData.push([""]);

  // Center info block
  sheetData.push([
    "Center Name",
    collectionGroup.centerName,
    "",
    "",
    "Collection Day",
    collectionGroup.collectionDay,
    "",
    "",
    "Collection Date",
    collectionGroup.collectionDate,
  ]);
  sheetData.push(["Number of Clients", members.length]);
  sheetData.push([""]);

  sheetData.push([
    "No.",
    "Client Name",
    "Contact",
    "Current Loan Amount",
    "Current Overall Amount",
    "Term Weeks",
    "Weekly Due",
    "Applied to Week",
    "Weekly Remaining",
    "Released on Selected Date",
    "Payments Made (Cumulative)",
    "Current Savings",
    "Current Balance",
    "Status",
    "Loan Condition",
  ]);

  members.forEach((member, index) => {
    const enriched = asExportable(member);
    const weekly = getWeeklyFinancialSummary([member]);
    const weeksPaid = getMemberWeeksPaid(enriched);
    const netRelease = getNetReleaseValue(enriched);
    sheetData.push([
      index + 1,
      `${member.lastName}, ${member.firstName} ${
        member.middleName || ""
      }`.trim(),
      `${member.contactNumber || ""}`,
      formatCurrencyCell(Number(member.totalLoanAmount) || 0),
      formatCurrencyCell(Number(member.overallAmount) || 0),
      member.totalTermWeeks || "0",
      formatWeeklyCell(weekly, weekly?.due),
      formatWeeklyCell(weekly, weekly?.applied),
      formatWeeklyCell(weekly, weekly?.remaining),
      formatCurrencyCell(Number(netRelease) || 0),
      weeksPaid || "0",
      formatCurrencyCell(Number(member.totalSavings) || 0),
      formatCurrencyCell(Number(member.totalBalance) || 0),
      getExportStatusLabel(member, collectionGroup.collectionDate),
      getLoanConditionLabel(member),
    ]);
  });

  sheetData.push([""]);

  // Financial summary block
  const totalLoanAmount = members.reduce(
    (sum, m) => sum + (m.totalLoanAmount || 0),
    0,
  );
  const totalOverallAmount = members.reduce(
    (sum, m) => sum + (m.overallAmount || 0),
    0,
  );
  const totalNetCashReleased = members.reduce(
    (sum, m) => sum + getNetReleaseValue(m),
    0,
  );
  const totalSavings = members.reduce(
    (sum, m) => sum + (m.totalSavings || 0),
    0,
  );
  const totalRemainingBalance = members.reduce(
    (sum, m) => sum + (m.totalBalance || 0),
    0,
  );
  const weeklySummary = getWeeklyFinancialSummary(members);
  const statusCounts = members.reduce(
    (counts, member) => {
      const status = getExportStatusLabel(
        member,
        collectionGroup.collectionDate,
      );
      if (status === "PAID") counts.paid += 1;
      else if (status === "PARTIAL") counts.partial += 1;
      else if (status === "PENDING") counts.pending += 1;
      else counts.unpaid += 1;
      return counts;
    },
    { paid: 0, partial: 0, pending: 0, unpaid: 0 },
  );

  sheetData.push(["Financial Summary"]);
  sheetData.push([""]);
  sheetData.push(["Current Loan Amount", formatCurrencyCell(totalLoanAmount)]);
  sheetData.push([
    "Current Overall Amount",
    formatCurrencyCell(totalOverallAmount),
  ]);
  sheetData.push([
    "Weekly Due",
    formatWeeklyCell(weeklySummary, weeklySummary?.due),
  ]);
  sheetData.push([
    "Applied to Week",
    formatWeeklyCell(weeklySummary, weeklySummary?.applied),
  ]);
  sheetData.push([
    "Weekly Remaining",
    formatWeeklyCell(weeklySummary, weeklySummary?.remaining),
  ]);
  if (mode === "daily") {
    sheetData.push([
      "Collected Today",
      formatCurrencyCell(Number(collectionGroup.totalReceived) || 0),
    ]);
    sheetData.push([
      "Released Today",
      formatCurrencyCell(totalNetCashReleased),
    ]);
  }
  sheetData.push(["Current Savings", formatCurrencyCell(totalSavings)]);
  sheetData.push([
    "Current Balance",
    formatCurrencyCell(totalRemainingBalance),
  ]);
  sheetData.push([""]);
  sheetData.push(["Payment Status Summary"]);
  sheetData.push(["Total Members", members.length]);
  sheetData.push(["Paid Members", statusCounts.paid]);
  sheetData.push(["Partial Payment Members", statusCounts.partial]);
  sheetData.push(["Pending Members", statusCounts.pending]);
  sheetData.push(["Unpaid Members", statusCounts.unpaid]);

  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 14 } },
  ];

  return { data: sheetData, merges };
};

// Helper: create worksheet with light styling
const buildWorksheet = async (
  data: (string | number)[][],
  merges: { s: { r: number; c: number }; e: { r: number; c: number } }[],
  sheetName: string,
) => {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(data) as WorksheetWithMeta;
  ws["!merges"] = merges;

  // Enhanced column widths for better readability
  const maxCols = data.reduce((max, r) => Math.max(max, r.length), 0);
  const maxColWidths = new Array(maxCols).fill(12);
  data.forEach((row) => {
    row.forEach((cell, idx) => {
      const len = String(cell ?? "").length;
      // Better width calculation for professional appearance
      maxColWidths[idx] = Math.min(
        Math.max(maxColWidths[idx], Math.min(len + 3, 35)),
        35,
      );
    });
  });
  ws["!cols"] = maxColWidths.map((w) => ({ width: w }));

  // Professional styling with colors and borders
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

  // Style company header (row 1-2) - Dark blue background with white text
  for (let r = 0; r <= 1; r++) {
    for (let c = 0; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
      ws[cellRef].s = {
        font: { bold: true, color: { rgb: "FFFFFF" }, size: 14 },
        fill: { fgColor: { rgb: "1F4E79" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };
    }
  }

  // Style center info section (rows 4-5) - Light blue background
  for (let r = 3; r <= 4; r++) {
    for (let c = 0; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
      ws[cellRef].s = {
        font: { bold: r === 3, size: 11 },
        fill: { fgColor: { rgb: "E7F3FF" } },
        alignment: {
          horizontal: r === 3 ? "center" : "left",
          vertical: "center",
        },
        border: {
          top: { style: "thin", color: { rgb: "CCCCCC" } },
          bottom: { style: "thin", color: { rgb: "CCCCCC" } },
          left: { style: "thin", color: { rgb: "CCCCCC" } },
          right: { style: "thin", color: { rgb: "CCCCCC" } },
        },
      };
    }
  }

  // Find and style table header row - Light gray background like reference image
  const headerRowIndex = data.findIndex((r) => r[0] === "No.");
  if (headerRowIndex >= 0) {
    const headerRow = data[headerRowIndex];
    console.log(
      "Found header row at index:",
      headerRowIndex,
      "with data:",
      headerRow,
    );

    for (let c = 0; c < headerRow.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c });
      if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };

      const cellStyle = {
        font: { bold: true, color: { rgb: "000000" }, size: 11 },
        fill: { fgColor: { rgb: "F0F0F0" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "medium", color: { rgb: "000000" } },
          bottom: { style: "medium", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };

      ws[cellRef].s = cellStyle;
      console.log(`Applied style to cell ${cellRef}:`, cellStyle);
    }

    // Style data rows with alternating colors and status-based formatting
    const dataStartRow = headerRowIndex + 1;
    const dataEndRow =
      data.findIndex((r, idx) => idx > headerRowIndex && r[0] === "") - 1;

    console.log("Styling data rows from", dataStartRow, "to", dataEndRow);

    for (let r = dataStartRow; r <= dataEndRow && r < data.length; r++) {
      const row = data[r];
      if (!row || row.length === 0) continue;

      const isEvenRow = (r - dataStartRow) % 2 === 0;
      const status = row[row.length - 1]; // Status is the last column

      for (let c = 0; c < row.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };

        let fillColor = isEvenRow ? "F8F9FA" : "FFFFFF"; // Alternating row colors
        let fontColor = "000000";

        // Special column color coding like reference image
        if (c === 9) {
          // No. of Payment column (index 9)
          fontColor = "FF0000"; // Red text like in reference
        } else if (c === 10) {
          // Savings column (index 10)
          fontColor = "FF00FF"; // Magenta text like in reference
        } else if (c === row.length - 1) {
          // Status column
          if (status === "PAID") {
            fillColor = "D4EDDA";
            fontColor = "155724";
          } else if (status === "PARTIAL") {
            fillColor = "FFF3CD";
            fontColor = "856404";
          } else if (status === "UNPAID") {
            fillColor = "F8D7DA";
            fontColor = "721C24";
          }
        }

        const cellStyle = {
          font: {
            color: { rgb: fontColor },
            size: 10,
            bold: c === row.length - 1, // Bold status column
          },
          fill: { fgColor: { rgb: fillColor } },
          alignment: {
            horizontal: c === 1 ? "left" : "center", // Client name left-aligned, others centered
            vertical: "center",
          },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
        };

        ws[cellRef].s = cellStyle;

        // Log first few cells for debugging
        if (r <= dataStartRow + 2 && c < 3) {
          console.log(
            `Applied style to cell ${cellRef} (row ${r}, col ${c}):`,
            cellStyle,
          );
        }
      }
    }
  }

  // Style Financial Summary section
  const summaryRowIndex = data.findIndex((r) => r[0] === "Financial Summary");
  if (summaryRowIndex >= 0) {
    // Summary header
    const cellRef = XLSX.utils.encode_cell({ r: summaryRowIndex, c: 0 });
    if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: "FFFFFF" }, size: 12 },
      fill: { fgColor: { rgb: "2E75B6" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "medium", color: { rgb: "000000" } },
        bottom: { style: "medium", color: { rgb: "000000" } },
        left: { style: "medium", color: { rgb: "000000" } },
        right: { style: "medium", color: { rgb: "000000" } },
      },
    };

    // Summary data rows
    for (let r = summaryRowIndex + 2; r < data.length; r++) {
      const row = data[r];
      if (!row || row.length === 0 || row[0] === "Payment Status Summary")
        break;

      for (let c = 0; c < Math.min(row.length, 2); c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
        ws[cellRef].s = {
          font: { bold: c === 0, size: 10 },
          fill: { fgColor: { rgb: "F0F8FF" } },
          alignment: {
            horizontal: c === 0 ? "left" : "right",
            vertical: "center",
          },
          border: {
            top: { style: "thin", color: { rgb: "CCCCCC" } },
            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
            left: { style: "thin", color: { rgb: "CCCCCC" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } },
          },
        };
      }
    }
  }

  // Style Payment Status Summary section
  const statusSummaryIndex = data.findIndex(
    (r) => r[0] === "Payment Status Summary",
  );
  if (statusSummaryIndex >= 0) {
    // Status summary header
    const cellRef = XLSX.utils.encode_cell({ r: statusSummaryIndex, c: 0 });
    if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: "FFFFFF" }, size: 12 },
      fill: { fgColor: { rgb: "70AD47" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "medium", color: { rgb: "000000" } },
        bottom: { style: "medium", color: { rgb: "000000" } },
        left: { style: "medium", color: { rgb: "000000" } },
        right: { style: "medium", color: { rgb: "000000" } },
      },
    };

    // Status summary data rows with color coding
    for (let r = statusSummaryIndex + 1; r < data.length; r++) {
      const row = data[r];
      if (!row || row.length === 0) break;

      let fillColor = "F0F8FF";
      if (row[0] && row[0].toString().includes("Paid")) fillColor = "E8F5E8";
      if (row[0] && row[0].toString().includes("Partial")) fillColor = "FFF8E1";
      if (row[0] && row[0].toString().includes("Unpaid")) fillColor = "FFEBEE";

      for (let c = 0; c < Math.min(row.length, 2); c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
        ws[cellRef].s = {
          font: { bold: c === 0, size: 10 },
          fill: { fgColor: { rgb: fillColor } },
          alignment: {
            horizontal: c === 0 ? "left" : "center",
            vertical: "center",
          },
          border: {
            top: { style: "thin", color: { rgb: "CCCCCC" } },
            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
            left: { style: "thin", color: { rgb: "CCCCCC" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } },
          },
        };
      }
    }
  }

  console.log("Final worksheet object:", ws);
  console.log("Worksheet keys:", Object.keys(ws));
  return { ws, sheetName };
};

export const exportToExcel = async (
  collectionGroup: DailyCollectionGroup,
  members: MemberWithLoans[],
): Promise<void> => {
  // Ensure alphabetical order in export (LastName, FirstName)
  const sortedMembers = [...members].sort((a, b) => {
    const al = `${(a.lastName || "").toLowerCase()} ${(
      a.firstName || ""
    ).toLowerCase()}`.trim();
    const bl = `${(b.lastName || "").toLowerCase()} ${(
      b.firstName || ""
    ).toLowerCase()}`.trim();
    return al.localeCompare(bl);
  });

  try {
    // Try using ExcelJS for better styling support
    console.log("Attempting to use ExcelJS for styling...");
    const ExcelJS = await import("exceljs");
    const FileSaver = await import("file-saver");

    console.log("ExcelJS imported successfully:", ExcelJS);
    const workbook = new ExcelJS.default.Workbook();
    const worksheet = workbook.addWorksheet("Group Report");
    console.log("Workbook and worksheet created successfully");

    // Helper functions for data calculations rooted in modal logic
    const getMemberReceived = (member: MemberWithLoans): number => {
      const enriched = asExportable(member);
      const candidates: number[] = [];

      const computedValue =
        enriched.__computed?.collectionMetrics?.received ??
        enriched.__computed?.paymentInfo?.totalPaid;
      if (computedValue !== null && computedValue !== undefined) {
        candidates.push(Number(computedValue) || 0);
      }

      const collection = enriched.collection as
        | CollectionWithReceived
        | undefined;
      const fromCollection =
        collection?.amountReceived ?? collection?.paymentReceived;
      if (fromCollection !== undefined && fromCollection !== null) {
        candidates.push(Number(fromCollection) || 0);
      }

      const activeLoan = (enriched.loans || []).find(
        (loan) => (loan?.status || "").toLowerCase() === "active",
      );
      if (activeLoan) {
        const amountPaidRaw = activeLoan?.amountPaid;
        if (amountPaidRaw !== undefined && amountPaidRaw !== null) {
          candidates.push(Number(amountPaidRaw) || 0);
        }
        const weeksPaid = Number(
          activeLoan?.weeksPaid ?? enriched.collection?.numberOfPayments ?? 0,
        );
        const weekly = Number(
          enriched.weeklyPaymentAmount ?? activeLoan?.weeklyPaymentAmount ?? 0,
        );
        if (weekly) {
          candidates.push(weeksPaid * weekly);
        }
      }

      if (candidates.length === 0) return 0;
      return Math.max(0, ...candidates.filter((n) => Number.isFinite(n)));
    };

    const getMemberDue = (member: MemberWithLoans): number => {
      const enriched = asExportable(member);
      const computedDue =
        enriched.__computed?.collectionMetrics?.due ??
        enriched.__computed?.collectionMetrics?.weeklyDue;
      if (computedDue !== undefined && computedDue !== null) {
        return Number(computedDue) || 0;
      }

      const collectionAmount = enriched.collection?.amount;
      if (collectionAmount !== undefined && collectionAmount !== null) {
        return Number(collectionAmount) || 0;
      }

      return Number(enriched.weeklyPaymentAmount ?? 0) || 0;
    };

    const getMemberWeeksPaid = (member: MemberWithLoans): number => {
      const enriched = asExportable(member);
      const computedWeeks =
        enriched.__computed?.paymentInfo?.weeksCovered ??
        enriched.__computed?.collectionMetrics?.weeksCovered;
      if (computedWeeks !== undefined && computedWeeks !== null) {
        return Number(computedWeeks) || 0;
      }

      const fromCollection = enriched.collection?.numberOfPayments;
      if (fromCollection !== undefined && fromCollection !== null) {
        return Number(fromCollection) || 0;
      }

      const activeLoan = (enriched.loans || []).find(
        (loan) => (loan?.status || "").toLowerCase() === "active",
      );
      return Number(activeLoan?.weeksPaid ?? 0) || 0;
    };

    const getMemberStatusLabel = (member: MemberWithLoans): string => {
      const enriched = asExportable(member);
      const label = enriched.__computed?.status?.label;
      if (label) return label;

      const statusInfo = evaluateMemberStatus(member, {
        collection: member.collection,
        referenceDate: collectionGroup.collectionDate,
      });
      return getOperationalCollectionStatus(member, statusInfo).label;
    };

    // Set column widths with better spacing
    worksheet.columns = [
      { width: 30 }, // No.
      { width: 30 }, // Client Name
      { width: 18 }, // Contact
      { width: 15 }, // Loan Amount
      { width: 15 }, // Overall Amount
      { width: 12 }, // Term Weeks
      { width: 15 }, // Amount Due
      { width: 18 }, // Payment Received
      { width: 15 }, // Net Released
      { width: 15 }, // No. of Payments
      { width: 15 }, // Savings
      { width: 18 }, // Remaining Balance
      { width: 12 }, // Status
    ];

    // Auto-fit header cells for better display
    worksheet.getRow(1).height = 20;
    worksheet.getRow(2).height = 20;
    worksheet.getRow(4).height = 18;
    worksheet.getRow(5).height = 18;

    // Add title rows
    worksheet.mergeCells("A1:M1");
    worksheet.getCell("A1").value = "DYNAMIC CREDIT AND LOAN SOLUTIONS (DCLA)";
    worksheet.getCell("A1").font = { bold: true, size: 14 };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    worksheet.mergeCells("A2:M2");
    worksheet.getCell("A2").value = "GROUP COLLECTION REPORT";
    worksheet.getCell("A2").font = { bold: true, size: 12 };
    worksheet.getCell("A2").alignment = { horizontal: "center" };

    // Add center info with better spacing
    worksheet.getCell("A4").value = "Center Name";
    worksheet.getCell("B4").value = collectionGroup.centerName;
    worksheet.getCell("E4").value = "Collection Day";
    worksheet.getCell("F4").value = collectionGroup.collectionDay;
    worksheet.getCell("I4").value = "Collection Date";
    worksheet.getCell("J4").value = collectionGroup.collectionDate;

    worksheet.getCell("A5").value = "Number of Clients";
    worksheet.getCell("B5").value = collectionGroup.totalMembers;
    worksheet.getCell("B5").alignment = { horizontal: "left" };

    // Style center info cells
    worksheet.getCell("A4").font = { bold: true };
    worksheet.getCell("E4").font = { bold: true };
    worksheet.getCell("I4").font = { bold: true };
    worksheet.getCell("A5").font = { bold: true };

    // Add table headers
    const headers = [
      "No.",
      "Client Name",
      "Contact",
      "Loan Amount",
      "Overall Amount",
      "Term Weeks",
      "Amount Due",
      "Payment Received",
      "Net Released",
      "No. of Payment",
      "Savings",
      "Remaining Balance",
      "Status",
    ];
    const headerRow = worksheet.getRow(7);

    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: "FF000000" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF0F0F0" },
      };
      cell.border = {
        top: { style: "medium", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    // Add data rows
    sortedMembers.forEach((member, index) => {
      const rowIndex = 8 + index;
      const row = worksheet.getRow(rowIndex);

      const enriched = asExportable(member);
      const received = getMemberReceived(enriched);
      const due = getMemberDue(enriched);
      const weeksPaid = getMemberWeeksPaid(enriched);
      const netRelease = getNetReleaseValue(enriched);
      const statusLabel = getMemberStatusLabel(enriched);

      const rowData = [
        index + 1,
        `${member.lastName}, ${member.firstName} ${
          member.middleName || ""
        }`.trim(),
        member.contactNumber || "",
        `₱${member.totalLoanAmount?.toLocaleString() || "0"}`,
        `₱${member.overallAmount?.toLocaleString() || "0"}`,
        member.totalTermWeeks || "0",
        `₱${Number(due || 0).toLocaleString()}`,
        `₱${(Number(received) || 0).toLocaleString()}`,
        `₱${(Number(netRelease) || 0).toLocaleString()}`,
        weeksPaid || "0",
        `₱${member.totalSavings?.toLocaleString() || "0"}`,
        `₱${member.totalBalance?.toLocaleString() || "0"}`,
        statusLabel,
      ];

      rowData.forEach((value, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        cell.value = value;

        // Special column colors
        if (colIndex === 9) {
          // No. of Payment column
          cell.font = { color: { argb: "FFFF0000" } }; // Red
        } else if (colIndex === 10) {
          // Savings column
          cell.font = { color: { argb: "FFFF00FF" } }; // Magenta
        } else if (colIndex === 12) {
          // Status column
          cell.font = { bold: true };
        }

        cell.border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };
        cell.alignment = {
          horizontal: colIndex === 1 ? "left" : "center",
          vertical: "middle",
        };
      });
    });

    // Add Financial Summary section
    const summaryStartRow = 8 + sortedMembers.length + 2;
    worksheet.getCell(`A${summaryStartRow}`).value = "Financial Summary";
    worksheet.getCell(`A${summaryStartRow}`).font = { bold: true, size: 12 };
    worksheet.getCell(`A${summaryStartRow}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
    worksheet.getCell(`A${summaryStartRow}`).border = {
      top: { style: "medium", color: { argb: "FF000000" } },
      bottom: { style: "medium", color: { argb: "FF000000" } },
      left: { style: "medium", color: { argb: "FF000000" } },
      right: { style: "medium", color: { argb: "FF000000" } },
    };

    // Calculate totals
    const totalLoanAmount = sortedMembers.reduce(
      (sum, m) => sum + (Number(m.totalLoanAmount) || 0),
      0,
    );
    const totalOverallAmount = sortedMembers.reduce(
      (sum, m) => sum + (Number(m.overallAmount) || 0),
      0,
    );
    const totalWeeklyPayments = sortedMembers.reduce((sum, m) => {
      const due = getMemberDue(asExportable(m));
      return sum + Number(due || 0);
    }, 0);
    const totalPaymentReceived = sortedMembers.reduce((sum, m) => {
      const received = getMemberReceived(asExportable(m));
      return sum + received;
    }, 0);
    const totalNetReleased = sortedMembers.reduce(
      (sum, m) => sum + getNetReleaseValue(asExportable(m)),
      0,
    );
    const totalSavings = sortedMembers.reduce(
      (sum, m) => sum + (Number(m.totalSavings) || 0),
      0,
    );
    const totalRemainingBalance = sortedMembers.reduce(
      (sum, m) => sum + (Number(m.totalBalance) || 0),
      0,
    );

    // Add financial summary data
    const financialData = [
      ["Total Loan Amount", `₱${totalLoanAmount.toLocaleString()}`],
      ["Total Overall Amount", `₱${totalOverallAmount.toLocaleString()}`],
      ["Total Weekly Payments", `₱${totalWeeklyPayments.toLocaleString()}`],
      ["Total Payment Received", `₱${totalPaymentReceived.toLocaleString()}`],
      ["Total Net Cash Released", `₱${totalNetReleased.toLocaleString()}`],
      ["Total Savings", `₱${totalSavings.toLocaleString()}`],
      ["Total Remaining Balance", `₱${totalRemainingBalance.toLocaleString()}`],
    ];

    financialData.forEach(([label, value], index) => {
      const rowNum = summaryStartRow + 2 + index;
      worksheet.getCell(`A${rowNum}`).value = label;
      worksheet.getCell(`B${rowNum}`).value = value;
      worksheet.getCell(`A${rowNum}`).font = { bold: true };
      worksheet.getCell(`B${rowNum}`).alignment = { horizontal: "right" };
    });

    // Add Payment Status Summary section
    const statusStartRow = summaryStartRow + 2 + financialData.length + 2;
    worksheet.getCell(`A${statusStartRow}`).value = "Payment Status Summary";
    worksheet.getCell(`A${statusStartRow}`).font = { bold: true, size: 12 };
    worksheet.getCell(`A${statusStartRow}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
    worksheet.getCell(`A${statusStartRow}`).border = {
      top: { style: "medium", color: { argb: "FF000000" } },
      bottom: { style: "medium", color: { argb: "FF000000" } },
      left: { style: "medium", color: { argb: "FF000000" } },
      right: { style: "medium", color: { argb: "FF000000" } },
    };

    // Calculate payment status counts
    const getStatusBuckets = () => {
      let paid = 0;
      let partial = 0;
      let unpaid = 0;
      sortedMembers.forEach((member) => {
        const status = getMemberStatusLabel(asExportable(member));
        if (status === "PAID") {
          paid += 1;
        } else if (status === "PARTIAL") {
          partial += 1;
        } else {
          unpaid += 1;
        }
      });
      return { paid, partial, unpaid };
    };

    const {
      paid: paidMembers,
      partial: partialMembers,
      unpaid: unpaidMembers,
    } = getStatusBuckets();

    // Add payment status data
    const statusData = [
      ["Paid Members", paidMembers.toString()],
      ["Partial Payment Members", partialMembers.toString()],
      ["Unpaid Members", unpaidMembers.toString()],
    ];

    statusData.forEach(([label, value], index) => {
      const rowNum = statusStartRow + 2 + index;
      worksheet.getCell(`A${rowNum}`).value = label;
      worksheet.getCell(`B${rowNum}`).value = value;
      worksheet.getCell(`A${rowNum}`).font = { bold: true };
      worksheet.getCell(`B${rowNum}`).alignment = { horizontal: "right" };
    });

    // Generate buffer and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const fileName = `Collection_Report_${
      collectionGroup.centerName
    }_${collectionGroup.collectionDate.replace(/-/g, "_")}.xlsx`;
    FileSaver.saveAs(blob, fileName);
  } catch (error) {
    console.warn("ExcelJS export failed, falling back to XLSX:", error);

    // Fallback to original XLSX method
    const XLSX = await import("xlsx");
    const FileSaver = await import("file-saver");

    const { data, merges } = buildGroupSheetData(
      collectionGroup,
      sortedMembers,
    );
    const { ws } = await buildWorksheet(data, merges, "Group Report");

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Group Report");

    const fileName = `Collection_Report_${
      collectionGroup.centerName
    }_${collectionGroup.collectionDate.replace(/-/g, "_")}.xlsx`;

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    FileSaver.saveAs(blob, fileName);
  }
};

// New: Export all collections for the day (multiple sheets, one per collection)
export const exportAllCollectionsToExcel = async (
  bundles: CollectionExportBundle[],
  fileNamePrefix = "Daily_Collections",
  mode: CollectionExportMode = "daily",
): Promise<void> => {
  if (!bundles || bundles.length === 0) return;
  const reportBundles = bundles.map(({ group, members }) => ({
    group,
    members: (members || []).filter(
      (member) => hasActiveLoan(member) && hasLoanAmount(member),
    ),
  }));
  const XLSX = await import("xlsx");
  const FileSaver = await import("file-saver");

  const workbook = XLSX.utils.book_new();

  // Build Summary sheet: aggregates across all groups for the day
  try {
    const totalReceived = reportBundles.reduce(
      (sum, bundle) => sum + (Number(bundle.group.totalReceived) || 0),
      0,
    );
    const weeklySummary = combineWeeklyFinancialSummaries(
      reportBundles.map((bundle) => getWeeklyFinancialSummary(bundle.members)),
    );
    const totalReleased = reportBundles.reduce(
      (sum, b) =>
        sum +
        (b.members || []).reduce(
          (s, m) => s + getNetReleaseValue(asExportable(m)),
          0,
        ),
      0,
    );
    const date = reportBundles[0]?.group.collectionDate || "";

    const summaryData: (string | number)[][] = [];
    summaryData.push(["DYNAMIC CREDIT AND LOAN SOLUTIONS (DCLA)"]); // title
    summaryData.push([
      mode === "daily"
        ? "END-OF-DAY COLLECTION SUMMARY"
        : "COLLECTION WEEK SUMMARY",
    ]);
    summaryData.push([""]);
    summaryData.push(["Date", date]);
    summaryData.push([""]);
    if (mode === "daily") {
      summaryData.push(["Collected Today", formatCurrencyCell(totalReceived)]);
      summaryData.push([
        "Weekly Remaining",
        formatWeeklyCell(weeklySummary, weeklySummary?.remaining),
      ]);
      summaryData.push(["Released Today", formatCurrencyCell(totalReleased)]);
    } else {
      summaryData.push([
        "Weekly Due",
        formatWeeklyCell(weeklySummary, weeklySummary?.due),
      ]);
      summaryData.push([
        "Applied to Week",
        formatWeeklyCell(weeklySummary, weeklySummary?.applied),
      ]);
      summaryData.push([
        "Weekly Remaining",
        formatWeeklyCell(weeklySummary, weeklySummary?.remaining),
      ]);
    }
    summaryData.push([""]);
    summaryData.push(["Breakdown by Center"]);
    summaryData.push(
      mode === "daily"
        ? ["Center", "Collected Today", "Weekly Remaining", "Released Today"]
        : ["Center", "Weekly Due", "Applied to Week", "Weekly Remaining"],
    );
    for (const { group, members } of reportBundles) {
      const centerWeeklySummary = getWeeklyFinancialSummary(members);
      const released = (members || []).reduce(
        (s, m) => s + getNetReleaseValue(asExportable(m)),
        0,
      );
      summaryData.push(
        mode === "daily"
          ? [
              group.centerName,
              formatCurrencyCell(Number(group.totalReceived) || 0),
              formatWeeklyCell(
                centerWeeklySummary,
                centerWeeklySummary?.remaining,
              ),
              formatCurrencyCell(released),
            ]
          : [
              group.centerName,
              formatWeeklyCell(centerWeeklySummary, centerWeeklySummary?.due),
              formatWeeklyCell(
                centerWeeklySummary,
                centerWeeklySummary?.applied,
              ),
              formatWeeklyCell(
                centerWeeklySummary,
                centerWeeklySummary?.remaining,
              ),
            ],
      );
    }

    const { ws: summaryWs } = await (async () => {
      const ws = XLSX.utils.aoa_to_sheet(summaryData) as WorksheetWithMeta;
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
      ];
      const maxCols = summaryData.reduce((m, r) => Math.max(m, r.length), 0);
      ws["!cols"] = new Array(maxCols).fill(0).map(() => ({ width: 22 }));
      return { ws };
    })();
    XLSX.utils.book_append_sheet(workbook, summaryWs, "Summary");
  } catch (e) {
    console.warn("Failed to build Summary sheet", e);
  }

  for (const { group, members } of reportBundles) {
    // Sort members alphabetically per sheet
    const sorted = [...members].sort((a, b) => {
      const al = `${(a.lastName || "").toLowerCase()} ${(
        a.firstName || ""
      ).toLowerCase()}`.trim();
      const bl = `${(b.lastName || "").toLowerCase()} ${(
        b.firstName || ""
      ).toLowerCase()}`.trim();
      return al.localeCompare(bl);
    });
    const { data, merges } = buildGroupSheetData(group, sorted, mode);
    const sheetTitleBase = `${group.centerName}`.trim();
    const sheetName = sheetTitleBase.substring(0, 31) || "Collection"; // Excel limit
    const { ws } = await buildWorksheet(data, merges, sheetName);
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  }

  const firstDate =
    reportBundles[0]?.group.collectionDate?.replace(/-/g, "_") || "";
  const fileName = `${fileNamePrefix}_${firstDate}.xlsx`;

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  FileSaver.saveAs(blob, fileName);
};
