import {
  differenceInDateOnlyDays,
  getWeeklyPenaltyAssessmentDate,
  laterDateOnly,
  parseDateOnly,
} from './date-only';

describe('parseDateOnly', () => {
  it.each([
    ['2026-09-07', 'Monday'],
    ['2026-09-08', 'Tuesday'],
    ['2024-02-29', 'Thursday'],
  ])(
    'parses %s as %s without changing its database value',
    (value, weekday) => {
      expect(parseDateOnly(value)).toEqual(
        expect.objectContaining({ value, weekday }),
      );
    },
  );

  it.each(['2026-02-29', '2026-09-31', '2026-13-01', '2026-9-07', 'invalid'])(
    'rejects invalid date-only input %s',
    (value) => {
      expect(() => parseDateOnly(value)).toThrow(RangeError);
    },
  );
});

describe('date-only financial helpers', () => {
  it('calculates calendar-day differences without timezone conversion', () => {
    expect(differenceInDateOnlyDays('2026-09-13', '2026-09-14')).toBe(1);
    expect(differenceInDateOnlyDays('2026-09-14', '2026-09-13')).toBe(-1);
  });

  it('returns the later validated date', () => {
    expect(laterDateOnly('2026-09-13', '2026-09-14')).toBe('2026-09-14');
  });

  it.each([
    ['2026-09-13', '2026-09-19'],
    ['2026-09-18', '2026-09-19'],
    ['2026-09-19', '2026-09-26'],
  ])('maps due date %s to assessment date %s', (dueDate, expected) => {
    expect(getWeeklyPenaltyAssessmentDate(dueDate)).toBe(expected);
  });
});
