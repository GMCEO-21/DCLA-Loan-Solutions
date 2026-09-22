const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export interface DateOnlyParts {
  value: string;
  year: number;
  month: number;
  day: number;
  weekday: (typeof WEEKDAYS)[number];
  weekdayIndex: number;
  utcTimestamp: number;
}

export function parseDateOnly(value: string): DateOnlyParts {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) throw new RangeError('Date must use YYYY-MM-DD format');

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year === 0) throw new RangeError('Date must contain a valid year');

  const calendarDate = new Date(0);
  calendarDate.setUTCHours(0, 0, 0, 0);
  calendarDate.setUTCFullYear(year, month - 1, day);

  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    throw new RangeError('Date must be a valid calendar date');
  }

  const weekdayIndex = calendarDate.getUTCDay();
  return {
    value,
    year,
    month,
    day,
    weekday: WEEKDAYS[weekdayIndex],
    weekdayIndex,
    utcTimestamp: calendarDate.getTime(),
  };
}

export function addDaysToDateOnly(date: DateOnlyParts, days: number): string {
  const result = new Date(date.utcTimestamp);
  result.setUTCDate(result.getUTCDate() + days);
  const year = String(result.getUTCFullYear()).padStart(4, '0');
  const month = String(result.getUTCMonth() + 1).padStart(2, '0');
  const day = String(result.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function differenceInDateOnlyDays(start: string, end: string): number {
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);
  return Math.trunc(
    (endDate.utcTimestamp - startDate.utcTimestamp) / (24 * 60 * 60 * 1000),
  );
}

export function laterDateOnly(left: string, right: string): string {
  parseDateOnly(left);
  parseDateOnly(right);
  return left >= right ? left : right;
}

export function getWeeklyPenaltyAssessmentDate(dueDate: string): string {
  const due = parseDateOnly(dueDate);
  const fridayIndex = 5;
  const daysUntilFriday = (fridayIndex - due.weekdayIndex + 7) % 7;
  return addDaysToDateOnly(due, daysUntilFriday + 1);
}
