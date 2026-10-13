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
  weeklyHasAllocation: boolean | null = null,
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
    weeklyHasAllocation,
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

  it("marks an existing unfunded next-week schedule Unpaid despite cumulative payments", () => {
    const currentMember = member(false, 1500, 0, false);
    const current = {
      ...evaluateMemberStatus(currentMember, {
        referenceDate: "2026-10-24",
      }),
      label: "PAID" as const,
      color: "success" as const,
    };

    expect(
      getOperationalCollectionStatus(currentMember, current),
    ).toMatchObject({ label: "UNPAID", color: "error" });
  });

  it("marks an existing partially funded schedule Partial", () => {
    const currentMember = member(false, 1500, 0, true);
    const current = {
      ...evaluateMemberStatus(currentMember),
      label: "PAID" as const,
      color: "success" as const,
    };

    expect(
      getOperationalCollectionStatus(currentMember, current),
    ).toMatchObject({ label: "PARTIAL", color: "warning" });
  });

  it("preserves Pending precedence", () => {
    const currentMember = member(true, 0, 0);
    const pending = {
      ...evaluateMemberStatus(currentMember),
      label: "PENDING" as const,
      color: "warning" as const,
    };
    expect(getOperationalCollectionStatus(currentMember, pending)).toBe(
      pending,
    );
  });

  it("preserves every existing status when the weekly schedule is missing", () => {
    const currentMember = member(null, 1500, 0);
    for (const label of ["PAID", "PARTIAL", "UNPAID"] as const) {
      const current = {
        ...evaluateMemberStatus(currentMember),
        label,
        color:
          label === "PAID"
            ? ("success" as const)
            : label === "PARTIAL"
              ? ("warning" as const)
              : ("error" as const),
      };
      expect(getOperationalCollectionStatus(currentMember, current)).toBe(
        current,
      );
    }
  });

  it("does not expose an Unavailable operational status", () => {
    const currentMember = member(null, 0, 0);
    const current = evaluateMemberStatus(currentMember);

    expect(getOperationalCollectionStatus(currentMember, current).label).toBe(
      "UNPAID",
    );
  });
});
