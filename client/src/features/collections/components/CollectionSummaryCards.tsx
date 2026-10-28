import {
  Box,
  Grid,
  Card,
  CardContent,
  Avatar,
  Typography,
} from "@mui/material";
import {
  People,
  CheckCircle,
  Schedule,
  Warning,
  HourglassEmpty,
  AccountBalanceWallet,
  Payments,
  RequestQuote,
} from "@mui/icons-material";
import type { DailyCollectionGroup } from "../types";

interface ComputedStats {
  paidCount: number;
  partialCount: number;
  pendingCount: number;
  unpaidCount: number;
  totalOverallAmount: number;
  totalRemainingBalance: number;
}

interface CollectionSummaryCardsProps {
  collectionGroup: DailyCollectionGroup;
  computedStats: ComputedStats | null;
  formatCurrency: (amount: number) => string;
  totalsOverride?: {
    totalMembers: number;
    totalAmount: number;
    totalReceived: number;
    pendingCollections: number;
  };
}

export function CollectionSummaryCards({
  collectionGroup,
  computedStats,
  formatCurrency,
  totalsOverride,
}: CollectionSummaryCardsProps) {
  const totalMembers =
    totalsOverride?.totalMembers ?? collectionGroup.totalMembers;
  const totalAmount =
    totalsOverride?.totalAmount ?? collectionGroup.totalAmount ?? 0;
  const totalReceived =
    totalsOverride?.totalReceived ?? collectionGroup.totalReceived ?? 0;

  const summaryCards = [
    {
      title: "Total Members",
      value: totalMembers,
      icon: People,
      color: "#1e3a8a",
      bgColor: "#eff6ff",
    },
    {
      title: "Paid",
      value: computedStats?.paidCount || 0,
      icon: CheckCircle,
      color: "#10b981",
      bgColor: "#f0fdf4",
    },
    {
      title: "Partial",
      value: computedStats?.partialCount || 0,
      icon: Schedule,
      color: "#f59e0b",
      bgColor: "#fffbeb",
    },
    {
      title: "Pending",
      value: computedStats?.pendingCount || 0,
      icon: HourglassEmpty,
      color: "#0284c7",
      bgColor: "#e0f2fe",
    },
    {
      title: "Unpaid",
      value: computedStats?.unpaidCount || 0,
      icon: Warning,
      color: "#ef4444",
      bgColor: "#fef2f2",
    },
  ];

  const financialCards = [
    {
      title: "Overall Amount",
      subtitle: "Principal + Interest",
      value: formatCurrency(
        computedStats?.totalOverallAmount || totalAmount || 0,
      ),
      icon: RequestQuote,
      color: "#8b5cf6",
      bgColor: "#faf5ff",
    },
    {
      title: "Payment Received",
      subtitle: "Today's Collections",
      value: formatCurrency(Number(totalReceived || 0)),
      icon: Payments,
      color: "#10b981",
      bgColor: "#f0fdf4",
    },
    {
      title: "Remaining Balance",
      subtitle: "Outstanding Amount",
      value: formatCurrency(computedStats?.totalRemainingBalance || 0),
      icon: AccountBalanceWallet,
      color: "#ef4444",
      bgColor: "#fef2f2",
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, backgroundColor: "action.hover" }}>
      {/* Status Summary Cards */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {summaryCards.map((card, index) => (
          <Grid item xs={6} md={2.4} key={index}>
            <Card
              elevation={0}
              sx={{
                textAlign: "center",
                height: "100%",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
              }}
            >
              <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Avatar
                  sx={{
                    bgcolor: card.color,
                    mx: "auto",
                    mb: 1,
                    width: 36,
                    height: 36,
                  }}
                >
                  <card.icon sx={{ fontSize: 24 }} />
                </Avatar>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: "text.primary", mb: 0.5 }}
                >
                  {card.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {card.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Financial Summary */}
      <Box
        sx={{
          p: { xs: 2, sm: 2.5 },
          backgroundColor: "background.paper",
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography
          variant="h6"
          sx={{ fontWeight: 600, color: "text.primary", mb: 2 }}
        >
          Financial Summary
        </Typography>
        <Grid container spacing={1.5}>
          {financialCards.map((card, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Card
                elevation={0}
                sx={{
                  height: "100%",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  backgroundColor: card.bgColor,
                }}
              >
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Avatar
                    sx={{
                      bgcolor: card.color,
                      mb: 1.5,
                      width: 36,
                      height: 36,
                    }}
                  >
                    <card.icon sx={{ fontSize: 28 }} />
                  </Avatar>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, color: card.color, mb: 1 }}
                  >
                    {card.value}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: "text.primary", mb: 0.25 }}
                  >
                    {card.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {card.subtitle}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
}
