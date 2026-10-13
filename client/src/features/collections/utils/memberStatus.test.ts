import { describe, expect, it } from "vitest";
import type { MemberWithLoans } from "../types";
import {
  evaluateMemberStatus,
  getOperationalCollectionStatus,
} from "./memberStatus";

const member = (
  weeklyPaid: boolean | null,
  amountPaid: number,
  paymentReceived: number,
): MemberWithLoans =>
  ({
    id: "member-1",
    loans: [
      {
        id: "loan-1",
        status: "active",
        amount: 3000,
        amountPaid,
        weeklyPaymentAmount: 1500,
        loanCreatedDate: "2026-10-17",
      },
    ],
    weeklyPaymentAmount: 1500,
    weeklyPaid,
    collection: { amount: 1500, paymentReceived },
  }) as unknown as MemberWithLoans;

describe("operational weekly Paid status", () => {
  it("makes a fully funded week Paid without changing amount fields", () => {
    const currentMember = member(true, 0, 0);
    const current = evaluateMemberStatus(currentMember, {
      referenceDate: "2026-10-20",
    });
    const operational = getOperationalCollectionStatus(currentMember, current);

    expect(operational.label).toBe("PAID");
    expect(operational.color).toBe("success");
    expect(operational.received).toBe(current.received);
    expect(operational.due).toBe(current.due);
    expect(operational.shortfall).toBe(current.shortfall);
  });

  it("does not derive the weekly Paid override from cumulative or exact-date payments", () => {
    for (const [amountPaid, paymentReceived] of [
      [0, 0],
      [10000, 5000],
    ]) {
      const currentMember = member(true, amountPaid, paymentReceived);
      const current = evaluateMemberStatus(currentMember, {
        referenceDate: "2026-10-20",
      });
      expect(getOperationalCollectionStatus(currentMember, current).label).toBe(
        "PAID",
      );
    }
  });

  it("preserves Pending precedence and existing non-funded labels", () => {
    const currentMember = member(true, 0, 0);
    const pending = {
      ...evaluateMemberStatus(currentMember),
      label: "PENDING" as const,
      color: "warning" as const,
    };
    expect(getOperationalCollectionStatus(currentMember, pending)).toBe(
      pending,
    );

    for (const label of ["PARTIAL", "UNPAID"] as const) {
      const unfundedMember = member(false, 0, 0);
      const current = {
        ...evaluateMemberStatus(unfundedMember),
        label,
      };
      expect(getOperationalCollectionStatus(unfundedMember, current)).toBe(
        current,
      );
    }
  });

  it("does not carry a previous week's Paid label into an unfunded Saturday", () => {
    const nextWeek = member(false, 1500, 0);
    nextWeek.weeklyHasAllocation = false;
    const previousPaid = {
      ...evaluateMemberStatus(nextWeek),
      label: "PAID" as const,
      color: "success" as const,
    };
    expect(getOperationalCollectionStatus(nextWeek, previousPaid).label).toBe(
      "UNPAID",
    );

    nextWeek.weeklyHasAllocation = true;
    expect(getOperationalCollectionStatus(nextWeek, previousPaid).label).toBe(
      "PARTIAL",
    );
  });
});
