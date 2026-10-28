import { Box, Paper, Skeleton, Stack } from "@mui/material";

export default function CenterLoadingSkeleton({
  rowCount,
}: {
  rowCount: number;
}) {
  return (
    <Box role="status" aria-label="Loading centers" sx={{ minWidth: 0 }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          gap: 2,
          mb: 3,
        }}
      >
        <Box sx={{ width: { xs: "100%", sm: "45%" } }}>
          <Skeleton width="55%" height={38} />
          <Skeleton width="90%" height={24} />
        </Box>
        <Skeleton
          variant="rounded"
          width={136}
          height={44}
          sx={{ maxWidth: "100%" }}
        />
      </Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <Skeleton variant="rounded" height={44} sx={{ flex: 1 }} />
        <Skeleton
          variant="rounded"
          width={160}
          height={44}
          sx={{ maxWidth: "100%" }}
        />
      </Stack>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <Skeleton width={160} height={32} sx={{ mb: 2 }} />
        <Stack spacing={1}>
          {Array.from({ length: rowCount }, (_, index) => (
            <Skeleton key={index} variant="rounded" height={56} />
          ))}
        </Stack>
      </Paper>
    </Box>
  );
}
