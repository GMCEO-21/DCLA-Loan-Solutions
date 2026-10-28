import { Box, Button, Paper, Typography } from "@mui/material";
import { Lock } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@features/auth/authStore";
import DashboardLayout from "@components/layout/PrivateLayout";
import { getDefaultRouteForRole } from "@features/auth/access";

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.user?.role);
  const actionPath = getDefaultRouteForRole(role);

  return (
    <DashboardLayout>
      <Box sx={{ backgroundColor: "#f8fafc", minHeight: "100vh", px: 3 }}>
        <Paper
          sx={{
            mt: 3,
            p: 5,
            borderRadius: 3,
            border: "1px solid #e2e8f0",
            textAlign: "center",
            background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              backgroundColor: "#fee2e2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 2,
            }}
          >
            <Lock sx={{ color: "#ef4444", fontSize: 32 }} />
          </Box>
          <Typography variant="h4" fontWeight={700} color="#1e293b" mb={1}>
            Access Restricted
          </Typography>
          <Typography variant="body1" color="#64748b" mb={3}>
            You do not have permission to view this page.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate(actionPath)}
            sx={{
              background:
                "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
              "&:hover": {
                background:
                  "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)",
              },
              borderRadius: 2,
              px: 4,
            }}
          >
            Go Back
          </Button>
        </Paper>
      </Box>
    </DashboardLayout>
  );
}
