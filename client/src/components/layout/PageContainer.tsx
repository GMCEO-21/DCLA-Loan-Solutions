import { Box } from "@mui/material";
import type { LayoutProps } from "../../types/common";

export default function PageContainer({ children }: LayoutProps) {
  return (
    <Box
      sx={{ width: "100%", minWidth: 0, px: { xs: 2, sm: 3, lg: 4 }, py: 3 }}
    >
      {children}
    </Box>
  );
}
