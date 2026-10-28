import { Box, CircularProgress, Typography } from "@mui/material";

export default function FullScreenLoader() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)",
      }}
    >
      <CircularProgress size={48} />
      <Typography variant="body1" color="text.secondary">
        Loading...
      </Typography>
    </Box>
  );
}
