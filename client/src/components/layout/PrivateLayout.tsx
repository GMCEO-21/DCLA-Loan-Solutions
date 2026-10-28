import { Box } from "@mui/material";
import Header from "../header/Header";
import type { LayoutProps } from "../../types/common";
import PageContainer from "./PageContainer";
import { headerHeight, navigationWidth } from "./navigation";

export default function DashboardLayout({ children }: LayoutProps) {
  return (
    <Box sx={{ display: "flex", width: "100%", maxWidth: "100%", minWidth: 0 }}>
      <Header />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: { xs: `${headerHeight}px`, lg: 0 },
          ml: { lg: `${navigationWidth}px` },
          width: { xs: "100%", lg: `calc(100% - ${navigationWidth}px)` },
          maxWidth: "100%",
          minWidth: 0,
          minHeight: "100vh",
          overflow: "visible",
          bgcolor: "background.default",
        }}
      >
        <PageContainer>{children}</PageContainer>
      </Box>
    </Box>
  );
}
