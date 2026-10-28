import { Box, Skeleton } from "@mui/material";

export default function MemberLoadingSkeleton({ count }: { count: number }) {
  return (
    <Box role="status" aria-label="Loading members" sx={{ minWidth: 0 }}>
      <Box
        sx={{ display: "flex", justifyContent: "space-between", gap: 2, mb: 3 }}
      >
        <Skeleton width="35%" height={44} />
        <Skeleton width="25%" height={44} />
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
          mb: 3,
        }}
      >
        <Skeleton variant="rounded" height={44} sx={{ flex: 1 }} />
        <Skeleton variant="rounded" height={44} sx={{ flex: 1 }} />
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            sm: "repeat(2, minmax(0, 1fr))",
          },
          gap: 2,
        }}
      >
        {Array.from({ length: count }, (_, index) => (
          <Skeleton key={index} variant="rounded" height={300} />
        ))}
      </Box>
    </Box>
  );
}
