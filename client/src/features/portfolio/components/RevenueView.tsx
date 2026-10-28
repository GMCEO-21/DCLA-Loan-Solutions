import { useState } from "react";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import Assessment from "@mui/icons-material/Assessment";
import Savings from "@mui/icons-material/Savings";
import ExpectedRevenueView from "./ExpectedRevenueView";
import ActualRevenueView from "./ActualRevenueView";

type RevenueMode = "expected" | "actual";

export default function RevenueView() {
  const [mode, setMode] = useState<RevenueMode>("expected");

  return (
    <Box>
      <Box
        sx={{
          mb: 3,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Revenue
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Switch between expected collected revenue and actual collected
            revenue.
          </Typography>
        </Box>
        <Tabs
          value={mode}
          onChange={(_event, nextValue: RevenueMode) => setMode(nextValue)}
          aria-label="Revenue views"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            "& .MuiTab-root": {
              minHeight: 48,
              minWidth: 120,
            },
          }}
        >
          <Tab
            value="expected"
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <Assessment sx={{ fontSize: 18 }} />
                <span>Expected</span>
              </Box>
            }
          />
          <Tab
            value="actual"
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <Savings sx={{ fontSize: 18 }} />
                <span>Actual</span>
              </Box>
            }
          />
        </Tabs>
      </Box>

      {mode === "expected" ? <ExpectedRevenueView /> : <ActualRevenueView />}
    </Box>
  );
}
