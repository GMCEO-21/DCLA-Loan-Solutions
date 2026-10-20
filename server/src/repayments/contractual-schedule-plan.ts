import { addDaysToDateOnly, parseDateOnly } from '../common/date-only';

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export interface ContractualSchedulePlanInput {
  releaseDate: string | null | undefined;
  collectionDay: string | null | undefined;
  termWeeks: number;
  weeklyPaymentAmount: number;
}

export function buildContractualDueDates(
  input: ContractualSchedulePlanInput,
): string[] | null {
  const termWeeks = Number(input.termWeeks);
  const weeklyPaymentAmount = Number(input.weeklyPaymentAmount);
  const collectionDay = input.collectionDay?.trim().toLowerCase();
  const targetWeekday = collectionDay
    ? WEEKDAY_INDEX[collectionDay]
    : undefined;
  const releaseDate = parseReleaseDate(input.releaseDate);

  if (
    !Number.isInteger(termWeeks) ||
    termWeeks <= 0 ||
    !Number.isFinite(weeklyPaymentAmount) ||
    weeklyPaymentAmount <= 0 ||
    targetWeekday === undefined ||
    !releaseDate
  ) {
    return null;
  }

  let daysUntilFirstDue = (targetWeekday - releaseDate.weekdayIndex + 7) % 7;
  if (daysUntilFirstDue === 0) daysUntilFirstDue = 7;

  const firstDueDate = addDaysToDateOnly(releaseDate, daysUntilFirstDue);
  return Array.from({ length: termWeeks }, (_, index) =>
    addDaysToDateOnly(parseDateOnly(firstDueDate), index * 7),
  );
}

function parseReleaseDate(
  value: string | null | undefined,
): ReturnType<typeof parseDateOnly> | null {
  if (!value) return null;
  try {
    return parseDateOnly(value);
  } catch {
    return null;
  }
}
