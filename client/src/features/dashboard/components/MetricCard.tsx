import type { ReactNode } from "react";
import { Box, Paper, Typography } from "@mui/material";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  accent: string;
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon,
  accent,
}: MetricCardProps) {
  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: "1px solid #e2e8f0",
        background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
        height: "100%",
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.25}>
        <Typography variant="body2" color="#64748b" fontWeight={700}>
          {title}
        </Typography>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2,
            background: `${accent}20`,
            color: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </Box>
      </Box>

      <Typography variant="h4" fontWeight={800} color="#0f172a" lineHeight={1.2}>
        {value}
      </Typography>
      <Typography variant="body2" color="#64748b" sx={{ mt: 0.75 }}>
        {subtitle}
      </Typography>
    </Paper>
  );
}
