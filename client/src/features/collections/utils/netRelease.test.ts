import { describe, expect, it } from "vitest";
import type { MemberWithLoans } from "../types";
import { computeNetReleaseForDate } from "./netRelease";

const member = {
  id: "member-1",
  loans: [
    {
      id: "loan-1",
      status: "active",
      loanCreatedDate: "2026-10-20T00:00:00.000Z",
      netCashReleased: 8000,
    },
  ],
} as unknown as MemberWithLoans;

describe("computeNetReleaseForDate", () => {
  it("includes net cash released only on the exact release date", () => {
    expect(computeNetReleaseForDate(member, "2026-10-20")).toBe(8000);
  });

  it.each([
    "2026-10-21",
    "2026-10-22",
    "2026-10-23",
    "2026-10-24",
    "2026-10-25",
    "2026-10-26",
  ])("does not repeat release value on %s", (date) => {
    expect(computeNetReleaseForDate(member, date)).toBe(0);
  });

  it("ignores inactive loans", () => {
    const inactive = {
      ...member,
      loans: [{ ...member.loans[0], status: "closed" }],
    } as MemberWithLoans;

    expect(computeNetReleaseForDate(inactive, "2026-10-20")).toBe(0);
  });
});
