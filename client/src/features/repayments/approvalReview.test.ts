import { describe, expect, it } from "vitest";
import {
  buildPendingPostingCsv,
  getRepaymentBorrowerName,
  getRepaymentReviewIssue,
  type RepaymentReviewEntry,
} from "./approvalReview";

const entry: RepaymentReviewEntry = {
  repayment: {
    id: "posting-a", amount: 550, status: "pending", createdAt: "2026-10-28T08:00:00Z",
    operationType: "payment", collectionDate: "2026-10-28",
    member: { id: "member-a", firstName: " Maria ", middleName: " A. ", lastName: " Cruz " },
    loan: { id: "loan-a", status: "active", balance: "1000.00" },
  },
  preview: {
    repaymentId: "posting-a", loanId: "loan-a", asOfDate: "2026-10-28",
    allocation: {
      eligible: false, cashReceived: 550, savingsUsed: 0, totalApplied: 550,
      penalty: { amount: 0, cashPortion: 0, savingsPortion: 0 },
      pastDueInterest: { amount: 0, cashPortion: 0, savingsPortion: 0 },
      contractual: { amount: 550, cashPortion: 550, savingsPortion: 0 }, unapplied: 0,
    },
  },
  error: null,
};

describe("Posting review", () => {
  it("uses the borrower attached to the posting, including a non-empty middle name", () => {
    expect(getRepaymentBorrowerName(entry.repayment)).toBe("Maria A. Cruz");
    expect(getRepaymentBorrowerName({ ...entry.repayment, member: undefined })).toBe("Borrower unavailable");
  });

  it("flags a legacy overpayment but allows the exact final balance", () => {
    const final = { ...entry, repayment: { ...entry.repayment, loan: { ...entry.repayment.loan!, balance: "450.00" } } };
    expect(getRepaymentReviewIssue(final)).toMatch(/exceeds the remaining loan balance/);
    expect(getRepaymentReviewIssue({ ...final, repayment: { ...final.repayment, amount: 450 } })).toBeNull();
  });

  it("allows cash above the contractual balance when a policy allocation legitimately pays charges", () => {
    expect(getRepaymentReviewIssue({
      ...entry,
      repayment: { ...entry.repayment, loan: { ...entry.repayment.loan!, balance: "450.00" } },
      preview: { ...entry.preview!, allocation: { ...entry.preview!.allocation, eligible: true } },
    })).toBeNull();
  });

  it("flags unapplied funds and unknown loan status while allowing a reversal on a paid loan", () => {
    expect(getRepaymentReviewIssue({
      ...entry, preview: { ...entry.preview!, allocation: { ...entry.preview!.allocation, unapplied: 10 } },
    })).toMatch(/exceed the total outstanding amount/);
    expect(getRepaymentReviewIssue({ ...entry, repayment: { ...entry.repayment, loan: { id: "loan-a" } } })).toMatch(/Loan status is unavailable/);
    expect(getRepaymentReviewIssue({ ...entry, repayment: { ...entry.repayment, loan: { id: "loan-a", status: "active" } } })).toMatch(/Loan balance is unavailable/);
    expect(getRepaymentReviewIssue({
      ...entry,
      repayment: { ...entry.repayment, operationType: "reversal", loan: { ...entry.repayment.loan!, status: "paid" } },
      preview: null,
    })).toBeNull();
  });

  it("exports names, amounts, and exact posting references without depending on list order", () => {
    const csv = buildPendingPostingCsv([entry, {
      ...entry,
      repayment: {
        ...entry.repayment, id: "posting-b", amount: 870,
        member: { id: "member-b", firstName: "Ana", lastName: "Reyes" },
      },
    }]);
    expect(csv).toContain('"Maria A. Cruz","posting-a","loan-a","payment","pending","550.00"');
    expect(csv).toContain('"Ana Reyes","posting-b","loan-a","payment","pending","870.00"');
  });

  it("quotes commas, newlines, and quotes and neutralizes formula cells in exported notes", () => {
    const csv = buildPendingPostingCsv([{
      ...entry, repayment: { ...entry.repayment, notes: '=HYPERLINK("example")\nreview, please' },
    }]);
    expect(csv).toContain('"\'=HYPERLINK(""example"")\nreview, please"');
  });
});
