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
  Divider,
  IconButton,
} from "@mui/material";
import { Payment, AccountBalance, Savings, Close } from "@mui/icons-material";
import { useState, useEffect } from "react";
import collectionsService from "../api";
import type { MemberWithLoans } from "../types";
import type { Repayment } from "@features/repayments/types";
import { getApiErrorMessage } from "@utils/apiError";

type MemberLoan = MemberWithLoans["loans"][number] & {
  weeklyPaymentAmount?: number;
  savings?: number;
};

const getActiveLoans = (member: MemberWithLoans): MemberLoan[] =>
  ((member.loans ?? []) as MemberLoan[]).filter(
    (loan) => (loan.status || "").toLowerCase() === "active",
  );

interface PaymentDialogProps {
  open: boolean;
  member: MemberWithLoans | null;
  onClose: () => void;
  onSuccess: (repayment: Repayment) => void;
  formatCurrency: (amount: number) => string;
  centerId: string;
  collectionDate: string;
}

export function PaymentDialog({
  open,
  member,
  onClose,
  onSuccess,
  formatCurrency,
  centerId,
  collectionDate,
}: PaymentDialogProps) {
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [useSavings, setUseSavings] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open && member) {
      setPaymentAmount("");
      setPaymentNotes("");
      setUseSavings(false);
      setError(null);
    }
  }, [open, member]);

  const handleSubmit = async () => {
    if (!member) return;

    setProcessing(true);
    setError(null);

    try {
      const amount = Number.parseFloat(paymentAmount || "0");
      if (Number.isNaN(amount) || amount < 0) {
        throw new Error("Payment amount must be a positive number or zero");
      }

      const activeLoans = getActiveLoans(member);
      const activeLoan = activeLoans[0];
      if (!activeLoan) {
        throw new Error("No active loan found for member");
      }
      if (activeLoans.length > 1) {
        throw new Error(
          "Member has multiple active loans. Resolve loan records before posting payment.",
        );
      }

      const weeklyPaymentDue =
        activeLoan.weeklyPaymentAmount || member.weeklyPaymentAmount || 0;
      const availableSavings = Number(activeLoan.savings || 0);
      const numericAmount = Math.max(amount, 0);
      const shortfall = Math.max(0, weeklyPaymentDue - numericAmount);
      const savingsToApply = useSavings
        ? Math.min(shortfall, Math.max(availableSavings, 0))
        : 0;

      if (!useSavings && numericAmount <= 0) {
        throw new Error("Payment amount must be greater than 0");
      }

      if (useSavings) {
        if (availableSavings <= 0) {
          throw new Error("No savings available to apply to this payment");
        }
        if (shortfall <= 0) {
          throw new Error(
            "Cash payment already covers the weekly amount. Reduce the amount or disable savings.",
          );
        }
        if (savingsToApply <= 0) {
          throw new Error(
            "Savings cannot cover the payment shortfall. Adjust the payment amount.",
          );
        }
      }

      const repayment = await collectionsService.createRepayment({
        loanId: activeLoan.id,
        memberId: member.id,
        centerId,
        amount: numericAmount,
        collectionDate,
        notes: paymentNotes,
        useSavings,
      });

      onSuccess(repayment);
    } catch (error) {
      console.error("Failed to process payment:", error);
      setError(getApiErrorMessage(error));
    } finally {
      setProcessing(false);
    }
  };

  if (!member) return null;

  const activeLoans = getActiveLoans(member);
  const activeLoan = activeLoans.length === 1 ? activeLoans[0] : undefined;
  const weeklyPayment =
    activeLoan?.weeklyPaymentAmount || member.weeklyPaymentAmount || 0;
  const availableSavings = Number(activeLoan?.savings ?? 0);
  const parsedAmount = Number.parseFloat(paymentAmount || "0");
  const paymentAmountNum = Number.isNaN(parsedAmount) ? 0 : parsedAmount;
  const shortfall = Math.max(0, weeklyPayment - paymentAmountNum);
  const canUseSavings = shortfall > 0 && availableSavings > 0;
  const savingsToApply = useSavings
    ? Math.min(shortfall, Math.max(availableSavings, 0))
    : 0;
  const isSubmitDisabled =
    processing ||
    activeLoans.length !== 1 ||
    (!useSavings && paymentAmountNum <= 0) ||
    (useSavings && (shortfall <= 0 || availableSavings <= 0));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      scroll="paper"
      aria-labelledby="payment-dialog-title"
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
        id="payment-dialog-title"
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
          <Payment color="primary" />
          <Box>
            <Typography variant="h6">Process Payment</Typography>
            <Typography variant="body2" color="text.secondary">
              {member.firstName} {member.lastName}
            </Typography>
          </Box>
        </Box>
        <IconButton
          aria-label="Close payment dialog"
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

        {activeLoans.length > 1 && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            Member has multiple active loans. Resolve loan records before
            posting payment.
          </Alert>
        )}

        {/* Member Financial Overview */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
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
                  <AccountBalance sx={{ color: "#ef4444" }} />
                  Outstanding Balance
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

          <Grid item xs={12} md={6}>
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
                  <Payment sx={{ color: "#3b82f6" }} />
                  Weekly Payment
                </Typography>
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 700, color: "#3b82f6" }}
                >
                  {formatCurrency(weeklyPayment)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
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
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  Collection Amount
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, color: "#059669" }}
                >
                  {formatCurrency(
                    member.collection?.amount || member.totalBalance,
                  )}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
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
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                  }}
                >
                  <Savings sx={{ fontSize: 16 }} />
                  Available Savings
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, color: "#f59e0b" }}
                >
                  {formatCurrency(availableSavings)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Payment Form */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Payment Amount"
            type="number"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            InputProps={{
              startAdornment: (
                <Typography sx={{ mr: 1, color: "#6b7280" }}>₱</Typography>
              ),
            }}
            sx={{ mb: 2 }}
            helperText={`Weekly payment: ${formatCurrency(weeklyPayment)}`}
          />

          {/* Savings Usage Option */}
          {canUseSavings && (
            <Card
              sx={{
                mb: 2,
                p: 2,
                backgroundColor: "#f0f9ff",
                border: "1px solid #0ea5e9",
                borderRadius: 2,
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Payment is short by {formatCurrency(shortfall)}. You can use
                savings to cover the difference.
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <input
                  type="checkbox"
                  id="useSavings"
                  checked={useSavings}
                  onChange={(e) => setUseSavings(e.target.checked)}
                />
                <label htmlFor="useSavings">
                  <Typography variant="body2">
                    Use {formatCurrency(Math.min(shortfall, availableSavings))}{" "}
                    from savings
                  </Typography>
                </label>
              </Box>
            </Card>
          )}

          <TextField
            fullWidth
            label="Payment Notes (Optional)"
            multiline
            rows={3}
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.target.value)}
            placeholder="Enter payment notes or remarks..."
          />
        </Box>

        {/* Payment Summary */}
        {(paymentAmountNum > 0 || (useSavings && savingsToApply > 0)) && (
          <Card
            elevation={0}
            sx={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}
          >
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: "#1e293b" }}>
                Payment Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Cash Payment:
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {formatCurrency(Math.max(paymentAmountNum, 0))}
                  </Typography>
                </Grid>
                {useSavings && (
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      From Savings:
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 600, color: "#f59e0b" }}
                    >
                      {formatCurrency(savingsToApply)}
                    </Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Total Payment:
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 700, color: "#10b981" }}
                  >
                    {formatCurrency(
                      Math.max(paymentAmountNum, 0) +
                        (useSavings ? savingsToApply : 0),
                    )}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}
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
          disabled={isSubmitDisabled}
          startIcon={processing ? <CircularProgress size={16} /> : <Payment />}
          sx={{
            minHeight: 44,
            width: { xs: "100%", sm: "auto" },
          }}
        >
          {processing ? "Processing..." : "Process Payment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
