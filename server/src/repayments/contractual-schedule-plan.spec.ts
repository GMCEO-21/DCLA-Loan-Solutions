import { buildContractualDueDates } from './contractual-schedule-plan';

describe('buildContractualDueDates', () => {
  it('uses the next center collection day and advances in seven-day periods', () => {
    expect(
      buildContractualDueDates({
        releaseDate: '2026-09-02',
        collectionDay: 'Tuesday',
        termWeeks: 3,
        weeklyPaymentAmount: 1500,
      }),
    ).toEqual(['2026-09-08', '2026-09-15', '2026-09-22']);
  });

  it('moves a same-day release to the following week', () => {
    expect(
      buildContractualDueDates({
        releaseDate: '2026-09-01',
        collectionDay: 'Tuesday',
        termWeeks: 2,
        weeklyPaymentAmount: 1500,
      }),
    ).toEqual(['2026-09-08', '2026-09-15']);
  });

  it('rejects incomplete planning inputs', () => {
    expect(
      buildContractualDueDates({
        releaseDate: null,
        collectionDay: 'Tuesday',
        termWeeks: 2,
        weeklyPaymentAmount: 1500,
      }),
    ).toBeNull();
  });

  it('keeps legacy calendar dates stable across process timezones', () => {
    const originalTimezone = process.env.TZ;
    let results: Array<string[] | null> = [];
    try {
      results = ['UTC', 'Asia/Manila', 'America/Los_Angeles'].map(
        (timezone) => {
          process.env.TZ = timezone;
          return buildContractualDueDates({
            releaseDate: '2026-07-13',
            collectionDay: 'Monday',
            termWeeks: 3,
            weeklyPaymentAmount: 760,
          });
        },
      );
    } finally {
      if (originalTimezone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimezone;
      }
    }

    expect(results).toEqual([
      ['2026-07-20', '2026-07-27', '2026-08-03'],
      ['2026-07-20', '2026-07-27', '2026-08-03'],
      ['2026-07-20', '2026-07-27', '2026-08-03'],
    ]);
  });
});
