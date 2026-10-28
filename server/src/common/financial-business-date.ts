const MANILA_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function getFinancialBusinessDate(at: Date = new Date()): string {
  if (Number.isNaN(at.getTime())) {
    throw new RangeError('Financial business date requires a valid timestamp');
  }

  const parts = MANILA_DATE_FORMATTER.formatToParts(at);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new RangeError('Unable to resolve the Asia/Manila business date');
  }

  return `${year}-${month}-${day}`;
}
