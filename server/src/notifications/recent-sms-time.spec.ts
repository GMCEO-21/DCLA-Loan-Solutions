import { getManilaDayBounds, toUtcTimestampParameter } from './recent-sms-time';

describe('recent SMS Manila day boundaries', () => {
  it('translates a Manila calendar day to the corresponding UTC range', () => {
    const bounds = getManilaDayBounds(new Date('2026-09-01T00:30:00.000Z'));

    expect(bounds.startUtc.toISOString()).toBe('2026-08-31T16:00:00.000Z');
    expect(bounds.endUtc.toISOString()).toBe('2026-09-01T16:00:00.000Z');
  });

  it('moves to the next Manila day exactly at Manila midnight', () => {
    const beforeMidnight = getManilaDayBounds(
      new Date('2026-09-01T15:59:59.999Z'),
    );
    const atMidnight = getManilaDayBounds(new Date('2026-09-01T16:00:00.000Z'));

    expect(beforeMidnight.startUtc.toISOString()).toBe(
      '2026-08-31T16:00:00.000Z',
    );
    expect(atMidnight.startUtc.toISOString()).toBe('2026-09-01T16:00:00.000Z');
  });

  it('creates an explicit UTC timestamp parameter for UTC-naive columns', () => {
    expect(toUtcTimestampParameter(new Date('2026-08-31T16:00:00.000Z'))).toBe(
      '2026-08-31 16:00:00.000',
    );
  });
});
