import { useState } from "react";
import AccountBalance from "@mui/icons-material/AccountBalance";
import Download from "@mui/icons-material/Download";
import Refresh from "@mui/icons-material/Refresh";
import Search from "@mui/icons-material/Search";
import TrendingUp from "@mui/icons-material/TrendingUp";
import {
  Box,
  Button,
  FormControl,
  InputAdornment,
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
  TextField,
  Typography,
} from "@mui/material";
import RequestErrorAlert from "@components/common/RequestErrorAlert";
import { useProjectedIncome } from "../hooks/useProjectedIncome";
import PortfolioMetricGrid from "./PortfolioMetricGrid";

const formatCurrency = (amount: number): string =>
  `\u20B1${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const numericCellSx = {
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

export default function ProjectedIncomeView() {
  const { data, loading, error, refetch } = useProjectedIncome();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!data) return;

    setExporting(true);
    try {
      const { exportProjectedIncomeToExcel } = await import(
        "../utils/exportUtils"
      );
      await exportProjectedIncomeToExcel(data);
    } catch (exportError) {
      console.error("Export failed:", exportError);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <Stack spacing={2} role="status" aria-label="Loading projected income">
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
          No projected income data available.
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
          <Typography variant="h6">Projected Income Analytics</Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor interest projections and outstanding balances across centers
          </Typography>
        </Box>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: "minmax(220px, 1fr) 112px auto",
            },
            gap: 1.5,
            alignItems: "center",
          }}
        >
          <TextField
            size="small"
            label="Search centers"
            placeholder="Search centers..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ "& .MuiInputBase-root": { minHeight: 44 } }}
          />
          <FormControl
            size="small"
            sx={{ "& .MuiInputBase-root": { minHeight: 44 } }}
          >
            <InputLabel id="projected-row-count-label">Rows</InputLabel>
            <Select labelId="projected-row-count-label" label="Rows" value={10}>
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={25}>25</MenuItem>
              <MenuItem value={50}>50</MenuItem>
            </Select>
          </FormControl>
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
            label: "Total Outstanding Balance",
            value: formatCurrency(data.totalOutstandingBalance),
            icon: <AccountBalance fontSize="small" />,
            color: "warning.dark",
          },
          {
            label: "Total Interest Income",
            value: formatCurrency(data.totalInterestIncome),
            icon: <TrendingUp fontSize="small" />,
            color: "success.main",
          },
        ]}
      />

      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          startIcon={<Download />}
          onClick={handleExport}
          disabled={exporting}
          sx={{ minHeight: 44, width: { xs: "100%", sm: "auto" } }}
        >
          {exporting ? "Exporting..." : "Export to Excel"}
        </Button>
      </Box>

      {data.centers.length === 0 ? (
        <Box sx={{ py: 6, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 600 }}>
            No projected income records available.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Center projections will appear here when available.
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
          <Table size="small" sx={{ minWidth: 680 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell>No.</TableCell>
                <TableCell>Center Name</TableCell>
                <TableCell align="right">Outstanding Balance</TableCell>
                <TableCell align="right">Interest Income</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.centers.map((center) => (
                <TableRow key={center.no} hover>
                  <TableCell>{center.no}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {center.centerName}
                  </TableCell>
                  <TableCell align="right" sx={numericCellSx}>
                    {formatCurrency(center.outstandingBalance)}
                  </TableCell>
                  <TableCell align="right" sx={numericCellSx}>
                    {formatCurrency(center.interestIncome)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow
                sx={{
                  bgcolor: "action.hover",
                  "& td": { borderTop: "2px solid", borderColor: "divider" },
                }}
              >
                <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  {data.centers.length} Centers
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ ...numericCellSx, fontWeight: 700 }}
                >
                  {formatCurrency(data.totalOutstandingBalance)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ ...numericCellSx, fontWeight: 700 }}
                >
                  {formatCurrency(data.totalInterestIncome)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
