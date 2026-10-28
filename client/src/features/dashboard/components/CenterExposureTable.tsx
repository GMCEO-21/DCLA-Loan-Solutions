import {
  Box,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { DashboardCenterMetric } from "../hooks/useDashboardData";
import {
  formatCurrency,
  formatPercent,
  getExposureColor,
} from "../utils/format";

interface CenterExposureTableProps {
  centers: DashboardCenterMetric[];
}

export default function CenterExposureTable({
  centers,
}: CenterExposureTableProps) {
  return (
    <Paper
      sx={{
        borderRadius: 3,
        border: "1px solid #e2e8f0",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      <Box p={2.5}>
        <Typography variant="h6" fontWeight={800} color="#0f172a" mb={0.5}>
          Center Exposure Overview
        </Typography>
        <Typography variant="body2" color="#64748b">
          Top centers sorted by outstanding balance.
        </Typography>
      </Box>
      <Divider />

      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 760 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Rank</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Center</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Disbursed
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Outstanding
              </TableCell>
              <TableCell sx={{ fontWeight: 700, minWidth: 180 }}>
                Exposure
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {centers.map((center) => {
              const ratio = Math.max(0, center.outstandingRatio);
              const cappedRatio = Math.min(ratio, 100);
              const overflowRatio = Math.max(0, ratio - 100);
              const barColor = getExposureColor(ratio);

              return (
                <TableRow key={`${center.centerName}-${center.rank}`} hover>
                  <TableCell>
                    <Chip size="small" label={`#${center.rank}`} />
                  </TableCell>
                  <TableCell>{center.centerName}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(center.amountDisbursed)}
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      component="span"
                      fontWeight={700}
                      color={
                        center.outstandingRatio >= 60
                          ? "#b91c1c"
                          : center.outstandingRatio >= 30
                            ? "#b45309"
                            : "#047857"
                      }
                    >
                      {formatCurrency(center.outstandingCollection)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <LinearProgress
                        variant="determinate"
                        value={cappedRatio}
                        sx={{
                          height: 8,
                          borderRadius: 8,
                          backgroundColor: "#e2e8f0",
                          "& .MuiLinearProgress-bar": {
                            backgroundColor: barColor,
                          },
                        }}
                      />
                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        mt={0.5}
                      >
                        <Typography variant="caption" color="#64748b">
                          {formatPercent(ratio)} of disbursed
                        </Typography>
                        {overflowRatio > 0 && (
                          <Typography
                            variant="caption"
                            sx={{ color: "#b91c1c", fontWeight: 700 }}
                          >
                            +{overflowRatio.toFixed(1)}% over
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}

            {centers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="#64748b" py={2}>
                    No center portfolio data available.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
