import type { MemberWithLoans } from "../types";
import { hasActiveLoan } from "./memberStatus";

export interface WeeklyFinancialSummary {
  due: number;
  applied: number;
  remaining: number;
  available: boolean;
  postMaturityLoanCount: number;
  incompleteScheduleLoanCount: number;
}

const toCents = (value: number) => Math.round(value * 100);

export const getWeeklyFinancialSummary = (
  members: MemberWithLoans[],
): WeeklyFinancialSummary | null => {
  const includedMembers = members.filter(hasActiveLoan);
  let dueCents = 0;
  let appliedCents = 0;
  let remainingCents = 0;
  let postMaturityLoanCount = 0;
  let incompleteScheduleLoanCount = 0;
  let historicalFundingUnavailable = false;

  for (const member of includedMembers) {
    const projection = member.weeklyFinancial;
    if (!projection) {
      incompleteScheduleLoanCount += 1;
      continue;
    }

    postMaturityLoanCount +=
      projection.kind === "post_maturity_no_weekly_obligation"
        ? Math.max(projection.postMaturityLoanCount, 1)
        : projection.postMaturityLoanCount;
    incompleteScheduleLoanCount +=
      projection.kind === "missing_schedule_unexpectedly"
        ? Math.max(projection.incompleteScheduleLoanCount, 1)
        : projection.incompleteScheduleLoanCount;

    if (projection.kind === "historical_funding_unavailable") {
      historicalFundingUnavailable = true;
    }

    if (projection.kind !== "scheduled_week") {
      continue;
    }

    const due = projection.amountDue;
    const applied = projection.amountApplied;
    if (
      due === null ||
      applied === null ||
      !Number.isFinite(Number(due)) ||
      !Number.isFinite(Number(applied))
    ) {
      incompleteScheduleLoanCount += 1;
      continue;
    }
    const memberDueCents = toCents(Number(due));
    const memberAppliedCents = toCents(Number(applied));
    dueCents += memberDueCents;
    appliedCents += memberAppliedCents;
    remainingCents += Math.max(memberDueCents - memberAppliedCents, 0);
  }

  return {
    due: dueCents / 100,
    applied: appliedCents / 100,
    remaining: remainingCents / 100,
    available:
      incompleteScheduleLoanCount === 0 && !historicalFundingUnavailable,
    postMaturityLoanCount,
    incompleteScheduleLoanCount,
  };
};

export const combineWeeklyFinancialSummaries = (
  summaries: Array<WeeklyFinancialSummary | null>,
): WeeklyFinancialSummary | null => {
  if (summaries.some((summary) => summary === null)) return null;

  const dueCents = summaries.reduce(
    (sum, summary) => sum + toCents(summary?.due ?? 0),
    0,
  );
  const appliedCents = summaries.reduce(
    (sum, summary) => sum + toCents(summary?.applied ?? 0),
    0,
  );
  const remainingCents = summaries.reduce(
    (sum, summary) => sum + toCents(summary?.remaining ?? 0),
    0,
  );
  const postMaturityLoanCount = summaries.reduce(
    (sum, summary) => sum + (summary?.postMaturityLoanCount ?? 0),
    0,
  );
  const incompleteScheduleLoanCount = summaries.reduce(
    (sum, summary) => sum + (summary?.incompleteScheduleLoanCount ?? 0),
    0,
  );

  return {
    due: dueCents / 100,
    applied: appliedCents / 100,
    remaining: remainingCents / 100,
    available: summaries.every((summary) => summary?.available),
    postMaturityLoanCount,
    incompleteScheduleLoanCount,
  };
};
