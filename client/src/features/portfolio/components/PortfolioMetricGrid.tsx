import type { ReactNode } from "react";
import { Box, Paper, Typography } from "@mui/material";

export interface PortfolioMetric {
  label: string;
  value: string;
  icon: ReactNode;
  color: string;
}

export default function PortfolioMetricGrid({
  metrics,
}: {
  metrics: PortfolioMetric[];
}) {
  return (
    <Box
      aria-label="Portfolio summary"
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          sm: "repeat(2, minmax(0, 1fr))",
          lg: `repeat(${Math.min(metrics.length, 4)}, minmax(0, 1fr))`,
        },
        gap: 2,
      }}
    >
      {metrics.map((metric) => (
        <Paper
          key={metric.label}
          elevation={0}
          sx={{
            minWidth: 0,
            minHeight: 112,
            p: 2,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Box
              aria-hidden="true"
              sx={{
                display: "flex",
                alignItems: "center",
                color: metric.color,
              }}
            >
              {metric.icon}
            </Box>
            <Typography variant="body2" color="text.secondary">
              {metric.label}
            </Typography>
          </Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: "text.primary",
              fontVariantNumeric: "tabular-nums",
              overflowWrap: "anywhere",
            }}
          >
            {metric.value}
          </Typography>
        </Paper>
      ))}
    </Box>
  );
}
