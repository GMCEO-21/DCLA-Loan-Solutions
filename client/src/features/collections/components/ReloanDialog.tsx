import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  TextField,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
  IconButton,
} from "@mui/material";
import AccountBalanceWallet from "@mui/icons-material/AccountBalanceWallet";
import Autorenew from "@mui/icons-material/Autorenew";
import Calculate from "@mui/icons-material/Calculate";
import Close from "@mui/icons-material/Close";
import { useState, useEffect, useMemo } from "react";
import { loansClient } from "../api";
import type { MemberWithLoans } from "../types";
import type { ReloanEligibility } from "../../loans/types";

type MemberLoan = MemberWithLoans["loans"][number] & {
  weeksPaid?: number;
  savings?: number;
};

type ReloanEligibilityResponse = ReloanEligibility & {
  message?: string;
};

interface ReloanDialogProps {
  open: boolean;
  member: MemberWithLoans | null;
  onClose: () => void;
  onSuccess: () => void;
  formatCurrency: (amount: number) => string;
}

export function ReloanDialog({
  open,
  member,
  onClose,
  onSuccess,
  formatCurrency,
}: ReloanDialogProps) {
  const [reloanPrincipal, setReloanPrincipal] = useState("");
  const [reloanTerm, setReloanTerm] = useState<4 | 8 | 12 | 24>(12);
  const [monthlyInterestRate, setMonthlyInterestRate] = useState("");
  const [reloanMode, setReloanMode] = useState<"payoff" | "netoff">("netoff");
  const [serviceCharge, setServiceCharge] = useState("");
  const [notarialFee, setNotarialFee] = useState("");
  const [savings, setSavings] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eligibility, setEligibility] =
    useState<ReloanEligibilityResponse | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open && member) {
      const activeLoan = member.loans?.find((l) => l.status === "active");
      setReloanPrincipal("");
      setReloanTerm(12);
      setMonthlyInterestRate("");
      setReloanMode("netoff");
      setServiceCharge("");
      setNotarialFee("");
      setSavings("");
      setError(null);
      setEligibility(null);

      // Check eligibility
      if (activeLoan) {
        checkEligibility(activeLoan.id);
      }
    }
  }, [open, member]);

  const checkEligibility = async (loanId: string) => {
    setLoadingEligibility(true);
    try {
      const result = await loansClient.checkEligibilityByLoan(loanId);
      setEligibility(result);
    } catch (error) {
      console.error("Failed to check eligibility:", error);
      setError("Failed to check reloan eligibility");
    } finally {
      setLoadingEligibility(false);
    }
  };

  // Calculate net cash released
  const netCashReleased = useMemo(() => {
    if (!member) return 0;

    const principal = Number(reloanPrincipal) || 0;
    const fee = Number(serviceCharge) || 0;
    const legalFee = Number(notarialFee) || 0;
    const savingsAmt = Number(savings) || 0;
    const oldBalance = Number(member.totalBalance) || 0;

    if (reloanMode === "payoff") {
      return Math.max(0, principal - fee - legalFee - savingsAmt);
    } else {
      return Math.max(0, principal - oldBalance - fee - legalFee - savingsAmt);
    }
  }, [
    reloanPrincipal,
    serviceCharge,
    notarialFee,
    savings,
    member,
    reloanMode,
  ]);

  const handleSubmit = async () => {
    if (!member) return;

    setProcessing(true);
    setError(null);

    try {
      const principal = Number(reloanPrincipal);
      if (principal <= 0) {
        throw new Error("Principal amount must be greater than 0");
      }
      const monthlyRate = Number(monthlyInterestRate);
      if (
        reloanTerm === 24 &&
        (!Number.isFinite(monthlyRate) ||
          monthlyRate < 3.33 ||
          monthlyRate > 10)
      ) {
        throw new Error("Monthly interest rate must be between 3.33% and 10%");
      }

      const activeLoan = member.loans?.find((l) => l.status === "active");
      if (!activeLoan) {
        throw new Error("No active loan found for member");
      }

      await loansClient.reloan(activeLoan.id, {
        newPrincipalAmount: principal,
        newTermWeeks: reloanTerm,
        ...(reloanTerm === 24 ? { monthlyInterestRate: monthlyRate } : {}),
        mode: reloanMode,
        serviceCharge: Number(serviceCharge) || 0,
        notarialFee: Number(notarialFee) || 0,
        ...(savings !== "" ? { savings: Number(savings) || 0 } : {}),
      });

      onSuccess();
    } catch (error) {
      console.error("Failed to process reloan:", error);
      setError(
        error instanceof Error ? error.message : "Failed to process reloan",
      );
    } finally {
      setProcessing(false);
    }
  };

  if (!member) return null;

  const activeLoan = member.loans?.find((l) => l.status === "active") as
    MemberLoan | undefined;
  const weeksPaid = activeLoan?.weeksPaid ?? 0;
  const existingSavings = Number(activeLoan?.savings ?? 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      scroll="paper"
      aria-labelledby="reloan-dialog-title"
      PaperProps={{
        sx: {
          width: "calc(100% - 32px)",
          maxWidth: 720,
          borderRadius: 2,
          overflow: "hidden",
        },
      }}
    >
      <DialogTitle
        id="reloan-dialog-title"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          p: { xs: 2, sm: 2.5 },
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Autorenew color="primary" />
          <Box>
            <Typography variant="h6">Process Reloan</Typography>
            <Typography variant="body2" color="text.secondary">
              {member.firstName} {member.lastName}
            </Typography>
          </Box>
        </Box>
        <IconButton
          aria-label="Close reloan dialog"
          onClick={onClose}
          sx={{ width: 44, height: 44, flexShrink: 0 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 2, sm: 2.5 }, overflowY: "auto" }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {/* Eligibility Check */}
        {loadingEligibility ? (
          <Card
            elevation={0}
            sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}
          >
            <CardContent sx={{ textAlign: "center" }}>
              <CircularProgress size={24} sx={{ mb: 1 }} />
              <Typography variant="body2">
                Checking reloan eligibility...
              </Typography>
            </CardContent>
          </Card>
        ) : eligibility ? (
          <Card
            elevation={0}
            sx={{
              mb: 3,
              border: `1px solid ${eligibility.eligible ? "#10b981" : "#ef4444"}`,
              backgroundColor: eligibility.eligible ? "#f0fdf4" : "#fef2f2",
            }}
          >
            <CardContent>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
              >
                <Chip
                  label={eligibility.eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}
                  color={eligibility.eligible ? "success" : "error"}
                  sx={{ fontWeight: 600 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {eligibility.message ||
                  (eligibility.eligible
                    ? "Member is eligible for reloan"
                    : "Member is not eligible for reloan")}
              </Typography>
            </CardContent>
          </Card>
        ) : null}

        {/* Current Loan Information */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card
              elevation={0}
              sx={{
                height: "100%",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <CardContent>
                <Typography
                  variant="h6"
                  sx={{
                    mb: 2,
                    color: "#1e293b",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <AccountBalanceWallet sx={{ color: "#ef4444" }} />
                  Current Balance
                </Typography>
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 700, color: "#ef4444" }}
                >
                  {formatCurrency(member.totalBalance)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card
              elevation={0}
              sx={{
                height: "100%",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, color: "#1e293b" }}>
                  Payments Made
                </Typography>
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 700, color: "#3b82f6" }}
                >
                  {weeksPaid} weeks
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card
              elevation={0}
              sx={{
                height: "100%",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, color: "#1e293b" }}>
                  Existing Savings
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 700,
                    color: existingSavings > 0 ? "#0f766e" : "#6b7280",
                  }}
                >
                  {formatCurrency(existingSavings)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Reloan Configuration */}
        <Typography
          variant="h6"
          sx={{
            mb: 3,
            color: "#1e293b",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Calculate />
          Reloan Configuration
        </Typography>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="New Principal Amount"
              type="number"
              value={reloanPrincipal}
              onChange={(e) => setReloanPrincipal(e.target.value)}

              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              InputProps={{
                startAdornment: (
                  <Typography sx={{ mr: 1, color: "#6b7280" }}>₱</Typography>
                ),
              }}
              helperText="Enter the new loan principal amount"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Term (Weeks)</InputLabel>
              <Select
                value={reloanTerm}
                label="Term (Weeks)"
                onChange={(e) => {
                  const nextTerm = e.target.value as 4 | 8 | 12 | 24;
                  setReloanTerm(nextTerm);
                  if (nextTerm !== 24) setMonthlyInterestRate("");
                }}
              >
                <MenuItem value={4}>4 weeks</MenuItem>
                <MenuItem value={8}>8 weeks</MenuItem>
                <MenuItem value={12}>12 weeks</MenuItem>
                <MenuItem value={24}>24 weeks (monthly interest)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {reloanTerm === 24 && (
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label="Monthly Interest Rate (%)"
                type="number"
                value={monthlyInterestRate}
                onChange={(e) => setMonthlyInterestRate(e.target.value)}
                inputProps={{ min: 3.33, max: 10, step: 0.01 }}
                helperText="Enter 3.33% to 10% per month"
              />
            </Grid>
          )}

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Reloan Mode</InputLabel>
              <Select
                value={reloanMode}
                label="Reloan Mode"
                onChange={(e) =>
                  setReloanMode(e.target.value as "payoff" | "netoff")
                }
              >
                <MenuItem value="netoff">Net Off (Deduct old balance)</MenuItem>
                <MenuItem value="payoff">
                  Pay Off (Full principal release)
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Service Charge"
              type="number"
              value={serviceCharge}
              onChange={(e) => setServiceCharge(e.target.value)}

              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              InputProps={{
                startAdornment: (
                  <Typography sx={{ mr: 1, color: "#6b7280" }}>₱</Typography>
                ),
              }}
              helperText="Processing fee for the reloan"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Notarial Fee"
              type="number"
              value={notarialFee}
              onChange={(e) => setNotarialFee(e.target.value)}

              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              InputProps={{
                startAdornment: (
                  <Typography sx={{ mr: 1, color: "#6b7280" }}>₱</Typography>
                ),
              }}
              helperText="Legal/notarial fee for the reloan"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Savings (optional)"
              type="number"
              value={savings}
              onChange={(e) => setSavings(e.target.value)}

              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              InputProps={{
                startAdornment: (
                  <Typography sx={{ mr: 1, color: "#6b7280" }}>₱</Typography>
                ),
              }}
              helperText="Set or adjust savings to carry on the new loan"
            />
          </Grid>
        </Grid>

        {/* Net Cash Released Preview */}
        <Card
          elevation={0}
          sx={{
            backgroundColor: "#f0f9ff",
            border: "1px solid #3b82f6",
            borderRadius: 2,
          }}
        >
          <CardContent>
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                color: "#1e293b",
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Calculate sx={{ color: "#3b82f6" }} />
              Net Cash Released (Preview)
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">
                  New Principal:
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {formatCurrency(Number(reloanPrincipal) || 0)}
                </Typography>
              </Grid>

              {reloanMode === "netoff" && (
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    Less: Old Balance:
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 600, color: "#ef4444" }}
                  >
                    -{formatCurrency(member.totalBalance)}
                  </Typography>
                </Grid>
              )}

              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">
                  Less: Service Charge:
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, color: "#f59e0b" }}
                >
                  -{formatCurrency(Number(serviceCharge) || 0)}
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">
                  Less: Notarial Fee:
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, color: "#f59e0b" }}
                >
                  -{formatCurrency(Number(notarialFee) || 0)}
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">
                  Less: Savings:
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, color: "#f59e0b" }}
                >
                  -{formatCurrency(Number(savings) || 0)}
                </Typography>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Net Cash to be Released:
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: netCashReleased > 0 ? "#10b981" : "#ef4444",
                }}
              >
                {formatCurrency(netCashReleased)}
              </Typography>
              {netCashReleased <= 0 && (
                <Typography variant="caption" color="error.main">
                  No cash will be released with current configuration
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </DialogContent>

      <DialogActions
        sx={{
          p: { xs: 2, sm: 2.5 },
          flexDirection: { xs: "column-reverse", sm: "row" },
          borderTop: "1px solid",
          borderColor: "divider",
          "& > :not(style) ~ :not(style)": { ml: 0 },
        }}
      >
        <Button
          onClick={onClose}
          sx={{ minHeight: 44, width: { xs: "100%", sm: "auto" } }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={
            processing ||
            !member ||
            netCashReleased < 0 ||
            !eligibility?.eligible
          }
          startIcon={
            processing ? <CircularProgress size={16} /> : <Autorenew />
          }
          sx={{
            minHeight: 44,
            width: { xs: "100%", sm: "auto" },
          }}
        >
          {processing ? "Processing..." : "Confirm Reloan"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
