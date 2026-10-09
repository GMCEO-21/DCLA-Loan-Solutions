import {
  Box,
  Chip,
  Paper,
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
import type { ChipProps } from "@mui/material";
import RequestErrorAlert from "@components/common/RequestErrorAlert";
import type {
  RecentSmsActivityResult,
  SmsEventType,
  SmsNotificationStatus,
} from "@features/notifications/types";
import {
  formatSmsActivityTime,
  selectSmsActivityTimestamp,
} from "../utils/recentSmsActivity";

interface RecentSmsActivityProps {
  data: RecentSmsActivityResult | null;
  loading: boolean;
  error: string | null;
  credits: number | undefined;
  creditsLoading: boolean;
  creditsError: boolean;
  onRetry?: () => void | Promise<void>;
}

const eventLabels: Record<SmsEventType, string> = {
  loan_created: "Loan Approval",
  repayment_posted: "Repayment",
};

const statusColors: Record<SmsNotificationStatus, ChipProps["color"]> = {
  pending: "warning",
  processing: "info",
  sent: "success",
  failed: "error",
};

export default function RecentSmsActivity({
  data,
  loading,
  error,
  credits,
  creditsLoading,
  creditsError,
  onRetry,
}: RecentSmsActivityProps) {
  const summaryMetrics = [
    {
      label: "Sent today",
      value: data?.summary.sentToday,
      color: "success.main",
      loading,
    },
    {
      label: "Pending",
      value: data?.summary.pending,
      color: "warning.dark",
      loading,
    },
    {
      label: "Failed today",
      value: data?.summary.failedToday,
      color: "error.main",
      loading,
    },
    {
      label: "SMS Credits",
      value:
        credits !== undefined
          ? `${credits.toLocaleString("en-PH")} remaining`
          : undefined,
      color: "text.primary",
      loading: creditsLoading,
      unavailable: creditsError,
    },
  ];

  return (
    <Paper
      component="section"
      aria-labelledby="sms-notifications-title"
      elevation={0}
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Box sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
        <Typography id="sms-notifications-title" variant="h6">
          SMS Notifications
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Delivery status for recent loan and repayment messages.
        </Typography>
      </Box>

      <Box
        aria-label="SMS notification summary"
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            sm: "repeat(2, minmax(0, 1fr))",
            md: "repeat(4, minmax(0, 1fr))",
          },
          borderTop: "1px solid",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        {summaryMetrics.map((metric, index) => (
          <Box
            key={metric.label}
            sx={{
              px: { xs: 2, sm: 3 },
              py: 1.5,
              borderRight: {
                xs: "none",
                sm: index % 2 === 1 ? "none" : "1px solid",
                md: index === 3 ? "none" : "1px solid",
              },
              borderBottom: {
                xs: index === 3 ? "none" : "1px solid",
                sm: index < 2 ? "1px solid" : "none",
                md: "none",
              },
              borderColor: "divider",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {metric.label}
            </Typography>
            {metric.value !== undefined && !metric.unavailable ? (
              <Typography
                variant="h6"
                sx={{ color: metric.color, fontVariantNumeric: "tabular-nums" }}
              >
                {metric.value}
              </Typography>
            ) : metric.loading ? (
              <Skeleton variant="text" width={44} height={28} />
            ) : (
              <Typography variant="body2" color="text.secondary">
                Unavailable
              </Typography>
            )}
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          px: { xs: 2, sm: 3 },
          py: 2,
          borderBottom: data?.items.length ? "1px solid" : "none",
          borderColor: "divider",
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Recent activity
        </Typography>
        {data && (
          <Typography variant="body2" color="text.secondary">
            Latest {data.items.length}
          </Typography>
        )}
      </Box>

      {error && (
        <Box sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
          <RequestErrorAlert
            message={error}
            onRetry={onRetry ? () => void onRetry() : undefined}
          />
        </Box>
      )}

      {loading && !data && (
        <Stack
          spacing={0}
          sx={{ px: { xs: 2, sm: 3 }, pb: 2.5 }}
          data-testid="recent-sms-loading"
          role="status"
          aria-label="Loading recent SMS activity"
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <Box
              key={index}
              sx={{
                py: 1.25,
                borderBottom: index === 4 ? "none" : "1px solid",
                borderColor: "divider",
              }}
            >
              <Skeleton variant="text" height={32} />
            </Box>
          ))}
        </Stack>
      )}

      {!loading && !error && data?.items.length === 0 && (
        <Box sx={{ textAlign: "center", py: 6, px: 2 }}>
          <Typography sx={{ fontWeight: 600 }}>
            No SMS notifications yet.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Recent loan and repayment notification activity will appear here.
          </Typography>
        </Box>
      )}

      {data && data.items.length > 0 && (
        <TableContainer sx={{ maxWidth: "100%", overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 680 }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: "action.hover" }}>
                <TableCell>Client</TableCell>
                <TableCell>Notification Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Time</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.notificationId} hover>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {item.memberName}
                  </TableCell>
                  <TableCell>{eventLabels[item.eventType]}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={statusColors[item.status]}
                      label={item.status}
                      variant="outlined"
                      sx={{
                        textTransform: "capitalize",
                        minWidth: 82,
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {formatSmsActivityTime(selectSmsActivityTimestamp(item))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
