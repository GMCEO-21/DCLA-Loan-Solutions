import { Box } from "@mui/material";
import Header from "@components/header/Header";
import type { LayoutProps } from "../../types/common";

export default function MemberLayout({ children }: LayoutProps) {
  return (
    <Box sx={{ display: "flex" }}>
      <Header title="Member Management" />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: 3,
          pb: 3,
          pt: "94px",
          width: "100%",
          minHeight: "100vh",
          overflow: "visible",
          background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
          transition: "width 0.3s ease-in-out",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
