import { Box, Button, Typography } from "@mui/material";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import { Link as RouterLink } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        bgcolor: "#fffdf9",
        px: 3,
        py: 8,
      }}
    >
      <Box sx={{ maxWidth: 560, textAlign: "center" }}>
        <Typography
          component="p"
          sx={{ color: "success.dark", fontWeight: 800, letterSpacing: 0 }}
        >
          404
        </Typography>
        <Typography
          component="h1"
          sx={{
            mt: 1,
            color: "primary.dark",
            fontSize: { xs: "2.25rem", sm: "3rem" },
            fontWeight: 750,
            lineHeight: 1.12,
          }}
        >
          Page Not Found
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 2, lineHeight: 1.7 }}>
          The page you requested does not exist or may have moved.
        </Typography>
        <Button
          component={RouterLink}
          to="/"
          variant="contained"
          color="success"
          startIcon={<HomeOutlinedIcon />}
          sx={{ mt: 4, minHeight: 48, color: "common.white" }}
        >
          Back to Home
        </Button>
      </Box>
    </Box>
  );
}
