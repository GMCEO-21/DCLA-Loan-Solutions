import { describe, expect, it } from "vitest";
import type { MemberWithLoans } from "../types";
import {
  combineWeeklyFinancialSummaries,
  getWeeklyFinancialSummary,
} from "./weeklySummary";

const member = (
  due: number,
  applied: number,
  overrides: Partial<MemberWithLoans> = {},
): MemberWithLoans =>
  ({
    id: "member-1",
    loans: [{ id: "loan-1", status: "active" }],
    weeklyFinancial: {
      kind: "scheduled_week",
      amountDue: due,
      amountApplied: applied,
      postMaturityLoanCount: 0,
      incompleteScheduleLoanCount: 0,
    },
    totalBalance: 9999,
    collection: { paymentReceived: 8888 },
    ...overrides,
  }) as unknown as MemberWithLoans;

const expected = (due: number, applied: number, remaining: number) => ({
  due,
  applied,
  remaining,
  available: true,
  postMaturityLoanCount: 0,
  incompleteScheduleLoanCount: 0,
});

describe("weekly Collections financial summary", () => {
  it.each([
    [1500, 1500, 0],
    [1500, 500, 1000],
    [1500, 0, 1500],
  ])(
    "calculates due %s, applied %s, and remaining %s",
    (due, applied, remaining) => {
      expect(getWeeklyFinancialSummary([member(due, applied)])).toEqual(
        expected(due, applied, remaining),
      );
    },
  );

  it("calculates remaining per member before aggregation", () => {
    expect(
      getWeeklyFinancialSummary([
        member(1500, 2000),
        member(1500, 0, { id: "member-2" }),
      ]),
    ).toEqual(expected(3000, 2000, 1500));
  });

  it("excludes post-maturity loans without invalidating scheduled totals", () => {
    const postMaturity = member(0, 0, {
      id: "member-2",
      weeklyFinancial: {
        kind: "post_maturity_no_weekly_obligation",
        amountDue: null,
        amountApplied: null,
        postMaturityLoanCount: 1,
        incompleteScheduleLoanCount: 0,
      },
    });

    expect(
      getWeeklyFinancialSummary([member(1500, 500), postMaturity]),
    ).toEqual({
      ...expected(1500, 500, 1000),
      postMaturityLoanCount: 1,
    });
  });

  it("marks totals unavailable for an unexpected missing schedule", () => {
    const incomplete = member(0, 0, {
      id: "member-2",
      weeklyFinancial: {
        kind: "missing_schedule_unexpectedly",
        amountDue: null,
        amountApplied: null,
        postMaturityLoanCount: 0,
        incompleteScheduleLoanCount: 1,
      },
    });

    expect(getWeeklyFinancialSummary([member(1500, 500), incomplete])).toEqual({
      ...expected(1500, 500, 1000),
      available: false,
      incompleteScheduleLoanCount: 1,
    });
  });

  it.each([
    "pre_first_due_no_weekly_obligation",
    "post_maturity_no_weekly_obligation",
  ] as const)("ignores the non-error %s kind", (kind) => {
    const noObligation = member(0, 0, {
      id: "member-2",
      weeklyFinancial: {
        kind,
        amountDue: null,
        amountApplied: null,
        postMaturityLoanCount:
          kind === "post_maturity_no_weekly_obligation" ? 1 : 0,
        incompleteScheduleLoanCount: 0,
      },
    });

    expect(
      getWeeklyFinancialSummary([member(1500, 500), noObligation]),
    ).toEqual({
      ...expected(1500, 500, 1000),
      postMaturityLoanCount:
        kind === "post_maturity_no_weekly_obligation" ? 1 : 0,
    });
  });

  it("marks historical funding unavailable without reporting a schedule issue", () => {
    const unavailable = member(0, 0, {
      id: "member-2",
      weeklyFinancial: {
        kind: "historical_funding_unavailable",
        amountDue: null,
        amountApplied: null,
        postMaturityLoanCount: 0,
        incompleteScheduleLoanCount: 0,
      },
    });

    expect(getWeeklyFinancialSummary([member(1500, 500), unavailable])).toEqual(
      {
        ...expected(1500, 500, 1000),
        available: false,
        incompleteScheduleLoanCount: 0,
      },
    );
  });

  it("is unaffected by cumulative loan and exact-date collection amounts", () => {
    const first = member(1500, 500, {
      loans: [{ id: "loan-1", status: "active", amountPaid: 0 } as never],
      collection: { paymentReceived: 0 } as never,
    });
    const changed = member(1500, 500, {
      loans: [{ id: "loan-1", status: "active", amountPaid: 999999 } as never],
      collection: { paymentReceived: 999999 } as never,
    });

    expect(getWeeklyFinancialSummary([first])).toEqual(
      getWeeklyFinancialSummary([changed]),
    );
  });

  it("combines center totals and metadata", () => {
    const postMaturity = member(0, 0, {
      weeklyFinancial: {
        kind: "post_maturity_no_weekly_obligation",
        amountDue: null,
        amountApplied: null,
        postMaturityLoanCount: 2,
        incompleteScheduleLoanCount: 0,
      },
    });

    expect(
      combineWeeklyFinancialSummaries([
        getWeeklyFinancialSummary([member(1500, 1500)]),
        getWeeklyFinancialSummary([member(1000, 400), postMaturity]),
      ]),
    ).toEqual({
      ...expected(2500, 1900, 600),
      postMaturityLoanCount: 2,
    });
  });
});
