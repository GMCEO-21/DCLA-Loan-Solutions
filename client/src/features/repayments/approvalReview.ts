import type { Repayment, RepaymentAllocationPreview } from "./types";

export interface RepaymentReviewEntry {
  repayment: Repayment;
  preview: RepaymentAllocationPreview | null;
  error: string | null;
}

export function getRepaymentBorrowerName(repayment: Repayment): string {
  return [
    repayment.member?.firstName,
    repayment.member?.middleName,
    repayment.member?.lastName,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ") || "Borrower unavailable";
}

export function getRepaymentReviewIssue(entry: RepaymentReviewEntry): string | null {
  const { repayment, preview, error } = entry;
  if (!repayment.member?.id || getRepaymentBorrowerName(repayment) === "Borrower unavailable") {
    return "Borrower information is unavailable. Refresh before approval.";
  }
  if (repayment.operationType === "reversal") return null;
  if (!repayment.loan?.status) {
    return "Loan status is unavailable. Refresh before approval.";
  }
  if (repayment.loan.status !== "active") {
    return `Payment is attached to a ${repayment.loan.status} loan. Reconcile this posting before approval.`;
  }
  if (repayment.loan.balance == null || !Number.isFinite(Number(repayment.loan.balance))) {
    return "Loan balance is unavailable. Refresh before approval.";
  }
  if (error) return error;
  if (preview?.allocation.unapplied && preview.allocation.unapplied > 0) {
    return "Posted funds exceed the total outstanding amount. Review the posting.";
  }
  if (
    preview &&
    !preview.allocation.eligible &&
    repayment.loan.balance != null &&
    Number(repayment.amount) > Number(repayment.loan.balance)
  ) {
    return "Posted amount exceeds the remaining loan balance. Review the posting.";
  }
  return null;
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^\s*[=+\-@]|^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildPendingPostingCsv(entries: RepaymentReviewEntry[]): string {
  const rows = [
    [
      "Borrower", "Posting ID", "Loan ID", "Entry Type", "Posting Status",
      "Posted Amount", "Use Savings", "Loan Status", "Loan Balance",
      "Collection Date", "Recorded At", "Notes", "Review Issue",
    ],
    ...entries.map((entry) => {
      const { repayment } = entry;
      return [
        getRepaymentBorrowerName(repayment),
        repayment.id,
        repayment.loan?.id,
        repayment.operationType ?? "payment",
        repayment.status,
        Number(repayment.amount).toFixed(2),
        repayment.useSavings ? "Yes" : "No",
        repayment.loan?.status,
        repayment.loan?.balance == null
          ? ""
          : Number(repayment.loan.balance).toFixed(2),
        repayment.collectionDate,
        repayment.createdAt,
        repayment.notes,
        getRepaymentReviewIssue(entry),
      ];
    }),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
