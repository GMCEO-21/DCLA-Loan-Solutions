const recordedTimestampFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

const manilaBusinessDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getManilaBusinessDate(at: Date = new Date()): string {
  if (Number.isNaN(at.getTime())) {
    throw new RangeError("Manila business date requires a valid timestamp");
  }

  const parts = manilaBusinessDateFormatter.formatToParts(at);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new RangeError("Unable to resolve the Asia/Manila business date");
  }

  return `${year}-${month}-${day}`;
}

export function formatRecordedTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return recordedTimestampFormatter.format(date);
}
