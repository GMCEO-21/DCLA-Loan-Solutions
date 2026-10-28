import { Box, Paper, Skeleton, Stack } from "@mui/material";

export function CollectionsTabLoadingSkeleton() {
  return (
    <Box role="status" aria-label="Loading collection records">
      <Skeleton variant="rounded" height={124} sx={{ mb: 2 }} />
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton
          key={index}
          variant="rounded"
          height={180}
          sx={{ mb: index === 2 ? 0 : 2 }}
        />
      ))}
    </Box>
  );
}

export default function CollectionsLoadingSkeleton() {
  return (
    <Box role="status" aria-label="Loading collections" sx={{ minWidth: 0 }}>
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
          <Skeleton variant="text" width={180} height={40} />
          <Skeleton
            variant="text"
            width={320}
            height={24}
            sx={{ maxWidth: "100%" }}
          />
        </Box>
        <Skeleton
          variant="rounded"
          width={142}
          height={44}
          sx={{ width: { xs: "100%", sm: 142 } }}
        />
      </Box>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          mb: 3,
          pb: 3,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Skeleton
          variant="rounded"
          height={44}
          sx={{ flex: 1, maxWidth: 480 }}
        />
        <Skeleton variant="rounded" width={170} height={44} />
      </Stack>

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
            display: "flex",
            gap: 2,
            p: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Skeleton variant="rounded" width={190} height={36} />
          <Skeleton variant="rounded" width={170} height={36} />
        </Box>
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <CollectionsTabLoadingSkeleton />
        </Box>
      </Paper>
    </Box>
  );
}
