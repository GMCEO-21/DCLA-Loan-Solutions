import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

export default function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "stretch", sm: "center" },
        justifyContent: "space-between",
        gap: 2,
        mb: 3,
        minWidth: 0,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="h1"
          variant="h4"
          sx={{ fontWeight: 700, overflowWrap: "anywhere" }}
        >
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        )}
      </Box>
      {actions && (
        <Box
          sx={{
            display: "flex",
            "& > .MuiButton-root": { width: { xs: "100%", sm: "auto" } },
          }}
        >
          {actions}
        </Box>
      )}
    </Box>
  );
}
