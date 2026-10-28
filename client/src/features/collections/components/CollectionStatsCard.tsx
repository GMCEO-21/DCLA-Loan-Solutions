import { Card, CardContent, Typography, Box, Avatar } from "@mui/material";
import type React from "react";

interface CollectionStatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: "primary" | "success" | "warning" | "error" | "info";
  subtitle?: string;
}

export default function CollectionStatsCard({
  title,
  value,
  icon,
  color,
  subtitle,
}: CollectionStatsCardProps) {
  const colorMap = {
    primary: "#1e3a8a",
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#0284c7",
  };

  return (
    <Card
      elevation={0}
      sx={{
        height: "100%",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <Avatar
            sx={{
              bgcolor: colorMap[color],
              mr: 2,
              width: 36,
              height: 36,
            }}
          >
            {icon}
          </Avatar>
          <Box>
            <Typography
              variant="h6"
              component="div"
              fontWeight="bold"
              color="text.primary"
            >
              {value}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontWeight: 500 }}
            >
              {title}
            </Typography>
          </Box>
        </Box>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
