import { useEffect, useMemo, useState } from "react";
import Assessment from "@mui/icons-material/Assessment";
import Paid from "@mui/icons-material/Paid";
import ReceiptLong from "@mui/icons-material/ReceiptLong";
import Refresh from "@mui/icons-material/Refresh";
import TrendingUp from "@mui/icons-material/TrendingUp";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import RequestErrorAlert from "@components/common/RequestErrorAlert";
import { useExpectedRevenue } from "../hooks/useExpectedRevenue";
import type { RevenueGranularity } from "../types";
import PortfolioMetricGrid from "./PortfolioMetricGrid";

const formatCurrency = (amount: number): string =>
  `\u20B1${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatWeeklyCollectionDay = (periodKey: string): string => {
  const [startKey, endKey] = periodKey.split("_");
  const startDate = new Date(`${startKey}T00:00:00Z`);
  const endDate = new Date(`${endKey}T00:00:00Z`);
  const startLabel = startDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return `${startLabel} (Day ${endDate.getUTCDate()})`;
};

const numericCellSx = {
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

export default function ExpectedRevenueView() {
  const [granularity, setGranularity] = useState<RevenueGranularity>("monthly");
  const [selectedMonth, setSelectedMonth] = useState(
    () => new Date().getMonth() + 1,
  );
  const [selectedYear, setSelectedYear] = useState(() =>
    new Date().getFullYear(),
  );
  const weeklyFilter =
    granularity === "weekly"
      ? { month: selectedMonth, year: selectedYear }
      : undefined;
  const { data, loading, error, refetch } = useExpectedRevenue(
    granularity,
    weeklyFilter,
  );
  const availableMonths = data?.availableMonths ?? [];
  const availableYears = useMemo(
    () => Array.from(new Set(availableMonths.map((option) => option.year))),
    [availableMonths],
  );
  const availableMonthsForYear = availableMonths.filter(
    (option) => option.year === selectedYear,
  );

  useEffect(() => {
    if (granularity !== "weekly" || availableMonths.length === 0) return;

    const hasSelection = availableMonths.some(
      (option) =>
        option.month === selectedMonth && option.year === selectedYear,
    );

    if (!hasSelection) {
      const latestMonth = availableMonths[availableMonths.length - 1];
      setSelectedMonth(latestMonth.month);
      setSelectedYear(latestMonth.year);
    }
  }, [availableMonths, granularity, selectedMonth, selectedYear]);

  if (loading) {
    return (
      <Stack spacing={2} role="status" aria-label="Loading expected revenue">
        <Skeleton variant="rounded" height={96} />
        <Skeleton variant="rounded" height={112} />
        <Skeleton variant="rounded" height={280} />
      </Stack>
    );
  }

  if (error) {
    return <RequestErrorAlert message={error} onRetry={refetch} />;
  }

  if (!data) {
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <Typography sx={{ fontWeight: 600 }}>
          No expected revenue data available.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={3} sx={{ minWidth: 0, maxWidth: "100%" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "stretch", lg: "flex-end" },
          flexDirection: { xs: "column", lg: "row" },
          gap: 2,
          p: 2,
          bgcolor: "action.hover",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6">Expected Revenue</Typography>
          <Typography variant="body2" color="text.secondary">
            {granularity === "weekly"
              ? "Weekly revenue shown by start day and end day"
              : "Monthly projections from repayment schedules and loan release fees"}
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            flexWrap: "wrap",
            gap: 1.5,
            alignItems: { xs: "stretch", sm: "center" },
          }}
        >
          <FormControl
            size="small"
            sx={{
              minWidth: { sm: 120 },
              "& .MuiInputBase-root": { minHeight: 44 },
            }}
          >
            <InputLabel id="expected-period-label">Period</InputLabel>
            <Select
              labelId="expected-period-label"
              label="Period"
              value={granularity}
              onChange={(event) =>
                setGranularity(event.target.value as RevenueGranularity)
              }
            >
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
            </Select>
          </FormControl>
          {granularity === "weekly" && (
            <>
              <FormControl
                size="small"
                sx={{
                  minWidth: { sm: 140 },
                  "& .MuiInputBase-root": { minHeight: 44 },
                }}
              >
                <InputLabel id="expected-month-label">Month</InputLabel>
                <Select
                  labelId="expected-month-label"
                  label="Month"
                  value={selectedMonth}
                  onChange={(event) =>
                    setSelectedMonth(Number(event.target.value))
                  }
                  disabled={availableMonthsForYear.length === 0}
                >
                  {availableMonthsForYear.map((option) => (
                    <MenuItem
                      key={`${option.year}-${option.month}`}
                      value={option.month}
                    >
                      {option.label.replace(` ${option.year}`, "")}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl
                size="small"
                sx={{
                  minWidth: { sm: 110 },
                  "& .MuiInputBase-root": { minHeight: 44 },
                }}
              >
                <InputLabel id="expected-year-label">Year</InputLabel>
                <Select
                  labelId="expected-year-label"
                  label="Year"
                  value={selectedYear}
                  onChange={(event) => {
                    const nextYear = Number(event.target.value);
                    const firstMonthForYear = availableMonths.find(
                      (option) => option.year === nextYear,
                    );
                    setSelectedYear(nextYear);
                    if (firstMonthForYear) {
                      setSelectedMonth(firstMonthForYear.month);
                    }
                  }}
                  disabled={availableYears.length === 0}
                >
                  {availableYears.map((year) => (
                    <MenuItem key={year} value={year}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => void refetch()}
            sx={{ minHeight: 44 }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <PortfolioMetricGrid
        metrics={[
          {
            label: "Expected Collected Interest",
            value: formatCurrency(data.totalExpectedInterest),
            icon: <TrendingUp fontSize="small" />,
            color: "success.main",
          },
          {
            label: "Service Charge",
            value: formatCurrency(data.totalServiceCharge),
            icon: <Paid fontSize="small" />,
            color: "primary.main",
          },
          {
            label: "Notarial Fee",
            value: formatCurrency(data.totalNotarialFee),
            icon: <ReceiptLong fontSize="small" />,
            color: "warning.dark",
          },
          {
            label: "Total Revenue",
            value: formatCurrency(data.totalRevenue),
            icon: <Assessment fontSize="small" />,
            color: "info.main",
          },
        ]}
      />

      {data.periods.length === 0 ? (
        <Box sx={{ py: 6, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 600 }}>
            No expected revenue records for this period.
          </Typography>
        </Box>
      ) : (
        <TableContainer
          sx={{
            maxWidth: "100%",
            overflowX: "auto",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                {granularity === "weekly" ? (
                  <>
                    <TableCell>Collection Week</TableCell>
                    <TableCell>Collection Day</TableCell>
                  </>
                ) : (
                  <TableCell>Period</TableCell>
                )}
                <TableCell align="right">Expected Collected Interest</TableCell>
                <TableCell align="right">Service Charge</TableCell>
                <TableCell align="right">Notarial Fee</TableCell>
                <TableCell align="right">Total Revenue</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.periods.map((period, index) => (
                <TableRow key={period.periodKey} hover>
                  {granularity === "weekly" ? (
                    <>
                      <TableCell sx={{ fontWeight: 600 }}>
                        Week {index + 1}
                      </TableCell>
                      <TableCell>
                        {formatWeeklyCollectionDay(period.periodKey)}
                      </TableCell>
                    </>
                  ) : (
                    <TableCell sx={{ fontWeight: 600 }}>
                      {period.periodLabel}
                    </TableCell>
                  )}
                  <TableCell align="right" sx={numericCellSx}>
                    {formatCurrency(period.expectedInterest)}
                  </TableCell>
                  <TableCell align="right" sx={numericCellSx}>
                    {formatCurrency(period.serviceCharge)}
                  </TableCell>
                  <TableCell align="right" sx={numericCellSx}>
                    {formatCurrency(period.notarialFee)}
                  </TableCell>
                  <TableCell align="right" sx={numericCellSx}>
                    {formatCurrency(period.totalRevenue)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow
                sx={{
                  bgcolor: "action.hover",
                  "& td": { borderTop: "2px solid", borderColor: "divider" },
                }}
              >
                <TableCell
                  colSpan={granularity === "weekly" ? 2 : 1}
                  sx={{ fontWeight: 700 }}
                >
                  Total
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ ...numericCellSx, fontWeight: 700 }}
                >
                  {formatCurrency(data.totalExpectedInterest)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ ...numericCellSx, fontWeight: 700 }}
                >
                  {formatCurrency(data.totalServiceCharge)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ ...numericCellSx, fontWeight: 700 }}
                >
                  {formatCurrency(data.totalNotarialFee)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ ...numericCellSx, fontWeight: 700 }}
                >
                  {formatCurrency(data.totalRevenue)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
