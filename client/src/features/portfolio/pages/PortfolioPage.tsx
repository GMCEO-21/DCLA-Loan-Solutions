import type React from "react";
import { useState } from "react";
import AccountBalance from "@mui/icons-material/AccountBalance";
import Assessment from "@mui/icons-material/Assessment";
import Download from "@mui/icons-material/Download";
import Refresh from "@mui/icons-material/Refresh";
import Search from "@mui/icons-material/Search";
import TrendingUp from "@mui/icons-material/TrendingUp";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import PageHeader from "@components/common/PageHeader";
import RequestErrorAlert from "@components/common/RequestErrorAlert";
import DashboardLayout from "@components/layout/PrivateLayout";
import PortfolioMetricGrid from "../components/PortfolioMetricGrid";
import ProjectedIncomeView from "../components/ProjectedIncomeView";
import RevenueView from "../components/RevenueView";
import { usePortfolio } from "../hooks/usePortfolio";

const formatCurrency = (amount: number): string =>
  `\u20B1${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const tableCellNumberSx = {
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

export default function PortfolioPage() {
  const { data, loading, error, refetch } = usePortfolio();
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const handleExport = async () => {
    if (!data) return;

    setExporting(true);
    try {
      const { exportPortfolioToExcel } = await import("../utils/exportUtils");
      await exportPortfolioToExcel(data);
    } catch (exportError) {
      console.error("Export failed:", exportError);
    } finally {
      setExporting(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <DashboardLayout>
      <Box sx={{ minWidth: 0, maxWidth: "100%" }}>
        <PageHeader
          title="Portfolio"
          description="Monitor lending portfolio and revenue performance."
          actions={
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={() => void refetch()}
              disabled={loading}
              sx={{ minHeight: 44 }}
            >
              Refresh
            </Button>
          }
        />

        {loading && (
          <Stack spacing={3} aria-label="Loading portfolio" role="status">
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  sm: "repeat(2, minmax(0, 1fr))",
                  lg: "repeat(3, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              {Array.from({ length: 3 }).map((_, index) => (
                <Paper
                  key={index}
                  elevation={0}
                  sx={{ p: 2, border: "1px solid", borderColor: "divider" }}
                >
                  <Skeleton width="45%" />
                  <Skeleton width="70%" height={32} />
                </Paper>
              ))}
            </Box>
            <Paper
              elevation={0}
              sx={{ p: 2, border: "1px solid", borderColor: "divider" }}
            >
              <Skeleton width="55%" height={44} />
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} height={52} />
              ))}
            </Paper>
          </Stack>
        )}

        {!loading && error && (
          <RequestErrorAlert message={error} onRetry={refetch} />
        )}

        {!loading && !error && !data && (
          <Alert severity="info">No portfolio data available</Alert>
        )}

        {!loading && !error && data && (
          <Stack spacing={3}>
            <PortfolioMetricGrid
              metrics={[
                {
                  label: "Total Centers",
                  value: String(data.centers.length),
                  icon: <AccountBalance fontSize="small" />,
                  color: "primary.main",
                },
                {
                  label: "Total Disbursed",
                  value: formatCurrency(data.totalAmountDisbursed),
                  icon: <TrendingUp fontSize="small" />,
                  color: "success.main",
                },
                {
                  label: "Outstanding Balance",
                  value: formatCurrency(data.totalOutstandingCollection),
                  icon: <Assessment fontSize="small" />,
                  color: "warning.dark",
                },
              ]}
            />

            <Box component="section" sx={{ minWidth: 0, maxWidth: "100%" }}>
              <Paper
                elevation={0}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  overflow: "hidden",
                }}
              >
                <Tabs
                  value={activeTab}
                  onChange={handleTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  aria-label="Portfolio views"
                  sx={{
                    px: { xs: 1, sm: 2 },
                    "& .MuiTab-root": { minHeight: 52 },
                  }}
                >
                  <Tab
                    icon={<AccountBalance fontSize="small" />}
                    iconPosition="start"
                    label={`Portfolio Overview (${data.centers.length})`}
                  />
                  <Tab
                    icon={<Assessment fontSize="small" />}
                    iconPosition="start"
                    label="Revenue"
                  />
                  <Tab
                    icon={<TrendingUp fontSize="small" />}
                    iconPosition="start"
                    label="Projected Income"
                  />
                </Tabs>
              </Paper>

              {activeTab === 0 && (
                <Box sx={{ pt: 3, minWidth: 0 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: { xs: "stretch", md: "flex-end" },
                      flexDirection: { xs: "column", md: "row" },
                      gap: 2,
                      mb: 3,
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
                      sx={{
                        width: { xs: "100%", md: 280 },
                        "& .MuiInputBase-root": { minHeight: 44 },
                      }}
                    />
                    <FormControl
                      size="small"
                      sx={{
                        width: { xs: "100%", md: 112 },
                        "& .MuiInputBase-root": { minHeight: 44 },
                      }}
                    >
                      <InputLabel id="portfolio-row-count-label">
                        Rows
                      </InputLabel>
                      <Select
                        labelId="portfolio-row-count-label"
                        label="Rows"
                        value={10}
                      >
                        <MenuItem value={10}>10</MenuItem>
                        <MenuItem value={25}>25</MenuItem>
                        <MenuItem value={50}>50</MenuItem>
                      </Select>
                    </FormControl>
                    <Button
                      variant="contained"
                      startIcon={<Download />}
                      onClick={handleExport}
                      disabled={exporting}
                      sx={{
                        minHeight: 44,
                        ml: { md: "auto" },
                        width: { xs: "100%", md: "auto" },
                      }}
                    >
                      {exporting ? "Exporting..." : "Export to Excel"}
                    </Button>
                  </Box>

                  {data.centers.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: "center" }}>
                      <Typography sx={{ fontWeight: 600 }}>
                        No portfolio records available.
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Center portfolio data will appear here when available.
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
                            <TableCell align="right">
                              Amount Disbursed
                            </TableCell>
                            <TableCell align="right">
                              Outstanding Collection
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {data.centers.map((center) => (
                            <TableRow key={center.no} hover>
                              <TableCell>{center.no}</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>
                                {center.centerName}
                              </TableCell>
                              <TableCell align="right" sx={tableCellNumberSx}>
                                {formatCurrency(center.amountDisbursed)}
                              </TableCell>
                              <TableCell align="right" sx={tableCellNumberSx}>
                                {formatCurrency(center.outstandingCollection)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow
                            sx={{
                              bgcolor: "action.hover",
                              "& td": {
                                borderTop: "2px solid",
                                borderColor: "divider",
                              },
                            }}
                          >
                            <TableCell sx={{ fontWeight: 700 }}>
                              Total
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>
                              {data.centers.length} Centers
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ ...tableCellNumberSx, fontWeight: 700 }}
                            >
                              {formatCurrency(data.totalAmountDisbursed)}
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ ...tableCellNumberSx, fontWeight: 700 }}
                            >
                              {formatCurrency(data.totalOutstandingCollection)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}

              {activeTab === 1 && (
                <Box sx={{ pt: 3, minWidth: 0 }}>
                  <RevenueView />
                </Box>
              )}

              {activeTab === 2 && (
                <Box sx={{ pt: 3, minWidth: 0 }}>
                  <ProjectedIncomeView />
                </Box>
              )}
            </Box>
          </Stack>
        )}
      </Box>
    </DashboardLayout>
  );
}
