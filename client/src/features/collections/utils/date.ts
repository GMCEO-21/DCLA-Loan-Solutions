export function formatCollectionDatasetDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function getCollectionWeekRange(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const selected = new Date(Date.UTC(year, month - 1, day));
  const offsetFromSaturday = (selected.getUTCDay() + 1) % 7;
  const weekStart = new Date(selected);
  weekStart.setUTCDate(selected.getUTCDate() - offsetFromSaturday);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  return {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
  };
}
