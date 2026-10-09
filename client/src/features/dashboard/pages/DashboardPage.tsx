import PendingActionsIcon from "@mui/icons-material/PendingActions";
import RefreshIcon from "@mui/icons-material/Refresh";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import PageHeader from "@components/common/PageHeader";
import PrivateLayout from "@components/layout/PrivateLayout";
import { useAuthStore } from "@features/auth/authStore";
import { useNavigate } from "react-router-dom";
import RecentSmsActivity from "../components/RecentSmsActivity";
import { useRecentSmsActivity } from "../hooks/useRecentSmsActivity";
import { useSmsCredits } from "../hooks/useSmsCredits";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    data,
    loading: activityLoading,
    error: activityError,
    refetch: refetchActivity,
  } = useRecentSmsActivity(10);
  const {
    credits,
    loading: creditsLoading,
    error: creditsError,
    refetch: refetchCredits,
  } = useSmsCredits();

  const refreshDashboard = () => {
    void refetchActivity();
    void refetchCredits();
  };

  const nowLabel = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  return (
    <PrivateLayout>
      <Box sx={{ minWidth: 0, maxWidth: "100%" }}>
        <PageHeader
          title="Dashboard"
          description="Overview of lending operations and recent activity."
          actions={
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={refreshDashboard}
              disabled={activityLoading || creditsLoading}
              sx={{ minHeight: 44 }}
            >
              Refresh
            </Button>
          }
        />

        <Stack spacing={3}>
          <Paper
            component="section"
            aria-labelledby="dashboard-approvals-title"
            elevation={0}
            sx={{
              borderRadius: 2,
              p: { xs: 2, sm: 2.5 },
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: { xs: "stretch", sm: "center" },
                gap: 2,
                flexDirection: { xs: "column", sm: "row" },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography id="dashboard-approvals-title" variant="h6">
                  Collection approvals
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  Review pending collection decisions and monitor recent
                  notifications.
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  {nowLabel} | Signed in as{" "}
                  <Box component="span" sx={{ overflowWrap: "anywhere" }}>
                    {user?.email}
                  </Box>
                </Typography>
              </Box>

              <Button
                variant="contained"
                startIcon={<PendingActionsIcon />}
                onClick={() => navigate("/approvals")}
                sx={{
                  minHeight: 44,
                  flexShrink: 0,
                  width: { xs: "100%", sm: "auto" },
                }}
              >
                Review Approvals
              </Button>
            </Box>
          </Paper>

          <RecentSmsActivity
            data={data}
            loading={activityLoading}
            error={activityError}
            credits={credits}
            creditsLoading={creditsLoading}
            creditsError={creditsError}
            onRetry={refetchActivity}
          />
        </Stack>
      </Box>
    </PrivateLayout>
  );
}
