import { Box, Paper, Skeleton, Stack } from "@mui/material";

type OperationalTableLoadingSkeletonProps = {
  actionWidth?: number;
  filterCount: number;
  rowCount?: number;
};

export default function OperationalTableLoadingSkeleton({
  actionWidth,
  filterCount,
  rowCount = 8,
}: OperationalTableLoadingSkeletonProps) {
  return (
    <Box
      role="status"
      aria-label="Loading operational records"
      sx={{ minWidth: 0, maxWidth: "100%" }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          gap: 2,
          mb: 3,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Skeleton variant="text" width={240} height={40} />
          <Skeleton
            variant="text"
            width={320}
            height={24}
            sx={{ maxWidth: "100%" }}
          />
        </Box>
        {actionWidth && (
          <Skeleton
            variant="rounded"
            width={actionWidth}
            height={44}
            sx={{ width: { xs: "100%", sm: actionWidth } }}
          />
        )}
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            sm:
              filterCount === 1
                ? "minmax(0, 360px)"
                : "repeat(2, minmax(0, 1fr))",
            lg:
              filterCount === 1
                ? "minmax(0, 360px)"
                : `repeat(${filterCount}, minmax(0, 1fr))`,
          },
          gap: 2,
          mb: 3,
          pb: 3,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        {Array.from({ length: filterCount }).map((_, index) => (
          <Skeleton key={index} variant="rounded" height={44} />
        ))}
      </Box>

      <Paper
        elevation={0}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            px: { xs: 2, sm: 3 },
            py: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Skeleton variant="text" width={190} height={28} />
          <Skeleton variant="text" width={150} height={20} />
        </Box>
        <Stack spacing={0}>
          {Array.from({ length: rowCount }).map((_, index) => (
            <Box
              key={index}
              sx={{
                px: { xs: 2, sm: 3 },
                py: 1.5,
                borderBottom: index === rowCount - 1 ? "none" : "1px solid",
                borderColor: "divider",
              }}
            >
              <Skeleton variant="text" height={32} />
            </Box>
          ))}
        </Stack>
      </Paper>
    </Box>
  );
}
