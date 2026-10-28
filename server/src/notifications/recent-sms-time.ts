const MANILA_TIME_ZONE = 'Asia/Manila';
const MANILA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

const MANILA_DATE_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: MANILA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export interface ManilaDayBounds {
  startUtc: Date;
  endUtc: Date;
}

export function getManilaDayBounds(now: Date = new Date()): ManilaDayBounds {
  const parts = MANILA_DATE_PARTS.formatToParts(now);
  const valueOf = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);

  const year = valueOf('year');
  const month = valueOf('month');
  const day = valueOf('day');
  const startUtc = new Date(
    Date.UTC(year, month - 1, day) - MANILA_UTC_OFFSET_MS,
  );

  return {
    startUtc,
    endUtc: new Date(startUtc.getTime() + 24 * 60 * 60 * 1000),
  };
}

export function toUtcTimestampParameter(value: Date): string {
  return value.toISOString().replace('T', ' ').replace('Z', '');
}
