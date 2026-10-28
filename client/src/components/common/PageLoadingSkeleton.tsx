import { Box, Grid, Paper, Skeleton, Stack } from "@mui/material";

type PageLoadingSkeletonProps = {
  showStats?: boolean;
  showTabs?: boolean;
  showFilters?: boolean;
  statCount?: number;
  filterCount?: number;
  rowCount?: number;
};

export default function PageLoadingSkeleton({
  showStats = true,
  showTabs = false,
  showFilters = true,
  statCount = 4,
  filterCount = 3,
  rowCount = 6,
}: PageLoadingSkeletonProps) {
  return (
    <Box sx={{ backgroundColor: "#f8fafc", minHeight: "100vh", minWidth: 0 }}>
      <Paper
        sx={{
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          border: "1px solid #e2e8f0",
          borderRadius: 3,
          p: { xs: 2, sm: 4 },
          mb: 3,
          boxShadow:
            "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          gap={3}
          flexWrap="wrap"
          mb={showStats ? 3 : 0}
        >
          <Box
            display="flex"
            alignItems="center"
            gap={3}
            sx={{ minWidth: 0, maxWidth: "100%" }}
          >
            <Skeleton
              variant="rounded"
              width={56}
              height={56}
              sx={{ flexShrink: 0 }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Skeleton
                variant="text"
                width={240}
                height={40}
                sx={{ maxWidth: "100%" }}
              />
              <Skeleton
                variant="text"
                width={320}
                height={24}
                sx={{ maxWidth: "100%" }}
              />
            </Box>
          </Box>
          {showFilters && (
            <Stack
              direction="row"
              spacing={2}
              flexWrap="wrap"
              useFlexGap
              sx={{ maxWidth: "100%" }}
            >
              {Array.from({ length: filterCount }).map((_, index) => (
                <Skeleton
                  key={`filter-${index}`}
                  variant="rounded"
                  width={index === filterCount - 1 ? 140 : 180}
                  height={40}
                  sx={{ maxWidth: "100%" }}
                />
              ))}
            </Stack>
          )}
        </Box>

        {showStats && (
          <Grid container spacing={2}>
            {Array.from({ length: statCount }).map((_, index) => (
              <Grid
                item
                xs={12}
                sm={6}
                md={12 / Math.min(statCount, 4)}
                key={index}
              >
                <Paper
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: "1px solid #e2e8f0",
                    boxShadow: "none",
                  }}
                >
                  <Skeleton variant="text" width="40%" height={24} />
                  <Skeleton variant="text" width="60%" height={36} />
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      <Box sx={{ px: { xs: 0, sm: 3 }, minWidth: 0 }}>
        <Paper
          sx={{
            borderRadius: 3,
            border: "1px solid #e2e8f0",
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            overflow: "hidden",
            p: 3,
          }}
        >
          {showTabs && (
            <Box
              sx={{
                display: "flex",
                gap: 2,
                flexWrap: "wrap",
                mb: 3,
                pb: 2,
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <Skeleton
                variant="rounded"
                width={180}
                height={36}
                sx={{ maxWidth: "100%" }}
              />
              <Skeleton
                variant="rounded"
                width={180}
                height={36}
                sx={{ maxWidth: "100%" }}
              />
            </Box>
          )}

          <Stack spacing={2}>
            {Array.from({ length: rowCount }).map((_, index) => (
              <Skeleton key={`row-${index}`} variant="rounded" height={56} />
            ))}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
