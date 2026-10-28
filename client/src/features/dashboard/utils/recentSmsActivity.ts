import type { RecentSmsActivityItem } from "@features/notifications/types";

export const selectSmsActivityTimestamp = (
  item: RecentSmsActivityItem
): string => {
  switch (item.status) {
    case "sent":
      return item.sentAt ?? item.createdAt;
    case "pending":
      return item.createdAt;
    case "processing":
    case "failed":
      return item.updatedAt;
  }
};

export const formatSmsActivityTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};
