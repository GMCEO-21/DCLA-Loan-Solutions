import { describe, expect, it } from "vitest";
import {
  formatSavingsBusinessDate,
  formatSavingsMoney,
  SAVINGS_EVENT_LABELS,
} from "./savings-history";
import { formatRecordedTimestamp } from "@utils/dateTime";

describe("savings history presentation", () => {
  it("maps every persisted ledger event to a readable label", () => {
    expect(SAVINGS_EVENT_LABELS).toEqual({
      opening_balance: "Opening Balance",
      loan_origination_contribution: "Loan Savings Contribution",
      reloan_contribution: "Reloan Savings Contribution",
      manual_deposit: "Deposit",
      manual_withdrawal: "Withdrawal",
      repayment_debit: "Repayment Using Savings",
      repayment_reversal_credit: "Repayment Reversal",
    });
  });

  it("formats exact decimal strings with explicit credit and debit signs", () => {
    expect(formatSavingsMoney("1000.00", true)).toBe("+₱1,000.00");
    expect(formatSavingsMoney("-300.00", true)).toBe("-₱300.00");
    expect(formatSavingsMoney("5500.00")).toBe("₱5,500.00");
  });

  it("formats business dates without timezone shifting and timestamps in Manila", () => {
    expect(formatSavingsBusinessDate("2026-09-03")).toBe("Sep 3, 2026");
    expect(formatRecordedTimestamp("2026-09-03T02:35:00.000Z")).toBe(
      "Sep 3, 2026, 10:35 AM",
    );
  });
});
