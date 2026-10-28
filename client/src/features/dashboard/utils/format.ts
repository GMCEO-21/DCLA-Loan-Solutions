export const formatCurrency = (amount: number): string =>
  `PHP ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

export const formatDate = (dateInput: string): string => {
  if (!dateInput) {
    return "Unknown date";
  }
  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) {
    return dateInput;
  }
  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const getExposureColor = (ratio: number): string => {
  if (ratio >= 60) return "#dc2626";
  if (ratio >= 30) return "#f59e0b";
  return "#10b981";
};
