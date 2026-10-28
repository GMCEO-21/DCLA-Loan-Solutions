import { Alert, Box, Chip, Paper, Stack, Typography } from "@mui/material";
import type { DashboardCollectionActivity } from "../hooks/useDashboardData";
import { formatCurrency, formatDate } from "../utils/format";

interface CollectionPulsePanelProps {
  activity: DashboardCollectionActivity[];
}

export default function CollectionPulsePanel({
  activity,
}: CollectionPulsePanelProps) {
  return (
    <Paper
      sx={{
        borderRadius: 3,
        border: "1px solid #e2e8f0",
        p: 2.5,
      }}
    >
      <Typography variant="h6" fontWeight={800} color="#0f172a" mb={0.5}>
        Collection Pulse (Today)
      </Typography>
      <Typography variant="body2" color="#64748b" mb={2}>
        Live posting activity by center.
      </Typography>

      <Stack spacing={1.25}>
        {activity.slice(0, 6).map((item) => (
          <Box
            key={`${item.centerId}-${item.collectionDate}`}
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
            }}
          >
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              mb={0.5}
            >
              <Typography variant="subtitle2" fontWeight={700} color="#0f172a">
                {item.centerName}
              </Typography>
              <Chip
                size="small"
                color={item.pendingCollections > 0 ? "warning" : "success"}
                label={
                  item.pendingCollections > 0
                    ? `${item.pendingCollections} pending`
                    : "Posted"
                }
              />
            </Box>
            <Typography variant="caption" color="#64748b" display="block">
              {formatDate(item.collectionDate)} | {item.totalMembers} members
            </Typography>
            <Typography variant="body2" color="#0f172a" mt={0.75}>
              Received: <strong>{formatCurrency(item.totalReceived)}</strong>
            </Typography>
            <Typography variant="caption" color="#64748b">
              Target: {formatCurrency(item.totalAmount)}
            </Typography>
          </Box>
        ))}

        {activity.length === 0 && (
          <Alert severity="info">No collection postings recorded today.</Alert>
        )}
      </Stack>
    </Paper>
  );
}
