import type { MemberWithLoans } from "../types";

type LoanLike = MemberWithLoans["loans"][number] & {
  status?: string;
  loanCreatedDate?: string | Date;
  createdAt?: string | Date;
  releaseDate?: string | Date;
  netCashReleased?: number | null;
  net_release?: number | null;
};

const normalizeDateOnly = (value?: string | Date | null): string | null => {
  if (!value) return null;

  if (typeof value === "string") {
    const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    if (dateOnly) return dateOnly;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
};

export const computeNetReleaseForDate = (
  member: MemberWithLoans,
  referenceDate?: string | Date | null,
): number => {
  const reference = normalizeDateOnly(referenceDate);
  if (!reference) return 0;

  const loans = Array.isArray(member.loans) ? (member.loans as LoanLike[]) : [];

  return loans.reduce((sum, loan) => {
    const status = `${loan?.status || ""}`.toLowerCase();
    if (status !== "active") {
      return sum;
    }

    const releaseDate = normalizeDateOnly(
      loan?.loanCreatedDate ?? loan?.createdAt ?? loan?.releaseDate ?? null,
    );
    if (!releaseDate) {
      return sum;
    }

    if (reference !== releaseDate) {
      return sum;
    }

    const netValue = Number(loan?.netCashReleased ?? loan?.net_release ?? 0);
    if (!Number.isFinite(netValue) || netValue <= 0) {
      return sum;
    }

    return sum + netValue;
  }, 0);
};

export const withNetReleaseForDate = <T extends MemberWithLoans>(
  member: T,
  referenceDate?: string | Date | null,
): T & { netCashReleasedForDate: number; netCashReleased: number } => {
  const netCashReleasedForDate = computeNetReleaseForDate(
    member,
    referenceDate,
  );
  return {
    ...member,
    netCashReleasedForDate,
    netCashReleased: netCashReleasedForDate,
  };
};
