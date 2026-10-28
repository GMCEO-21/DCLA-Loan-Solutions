import { describe, expect, it } from "vitest";
import { shouldOfferRepaymentSms } from "./eligibility";
import type { Repayment } from "@features/repayments/types";

const repayment = (
  status: Repayment["status"],
  operationType: Repayment["operationType"] = "payment"
): Repayment => ({
  id: "repayment-id",
  amount: 1000,
  status,
  operationType,
  createdAt: "2026-08-26T00:00:00.000Z",
});

describe("shouldOfferRepaymentSms", () => {
  it("allows an Admin direct-approved ordinary payment", () => {
    expect(shouldOfferRepaymentSms(repayment("approved"))).toBe(true);
  });

  it("does not prompt for a cashier pending payment", () => {
    expect(shouldOfferRepaymentSms(repayment("pending"))).toBe(false);
  });

  it("does not prompt for rejected payments or reversals", () => {
    expect(shouldOfferRepaymentSms(repayment("rejected"))).toBe(false);
    expect(shouldOfferRepaymentSms(repayment("approved", "reversal"))).toBe(false);
  });

  it("does not prompt when operationType is missing or unknown", () => {
    expect(
      shouldOfferRepaymentSms({
        ...repayment("approved"),
        operationType: undefined,
      })
    ).toBe(false);
    expect(
      shouldOfferRepaymentSms({
        ...repayment("approved"),
        operationType: "unknown" as Repayment["operationType"],
      })
    ).toBe(false);
  });
});
