import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  IconButton,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import ArrowForward from "@mui/icons-material/ArrowForward";
import Close from "@mui/icons-material/Close";
import History from "@mui/icons-material/History";
import Savings from "@mui/icons-material/Savings";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useQueryClient } from "react-query";
import savingsService from "@features/savings/api";
import { savingsHistoryKeys } from "@features/savings/hooks/useSavingsHistory";
import SavingsHistoryDialog from "./SavingsHistoryDialog";

interface MemberLite {
  id: string;
  firstName: string;
  lastName: string;
}

interface SavingsSummary {
  activeLoanId: string | null;
  currentSavings: number;
  hasActiveLoan: boolean;
}

type SavingsSummaryResponse = {
  activeLoanId?: string | null;
  activeLoanSavings?: number;
  currentSavings?: number;
  hasActiveLoan?: boolean;
};

type SavingsTransactionResponse = {
  loan?: {
    id?: string;
    savings?: number;
  };
};

interface SavingsDepositDialogProps {
  open: boolean;
  member: MemberLite | null;
  onClose: () => void;
  onSuccess: () => void;
  formatCurrency: (amount: number) => string;
}

export function SavingsDepositDialog({
  open,
  member,
  onClose,
  onSuccess,
  formatCurrency,
}: SavingsDepositDialogProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SavingsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const previewAmount = Number.parseFloat(amount || "0");
  const currentSavings = summary?.currentSavings ?? 0;
  const hasActiveLoan = Boolean(summary?.hasActiveLoan && summary.activeLoanId);
  const isWithdraw = mode === "withdraw";
  const projectedSavings = useMemo(() => {
    if (Number.isNaN(previewAmount) || previewAmount <= 0) {
      return currentSavings;
    }
    return isWithdraw
      ? Math.max(currentSavings - previewAmount, 0)
      : currentSavings + previewAmount;
  }, [currentSavings, previewAmount, isWithdraw]);
  const insufficientFunds =
    isWithdraw && previewAmount > 0 && previewAmount > currentSavings;

  useEffect(() => {
    if (!open || !member) {
      setHistoryOpen(false);
      setSummary(null);
      setSummaryError(null);
      setAmount("");
      setError(null);
      setMode("deposit");
      return;
    }

    setAmount("");
    setError(null);
    setMode("deposit");

    setSummaryLoading(true);
    setSummaryError(null);

    savingsService
      .getByMember(member.id)
      .then((data: SavingsSummaryResponse) => {
        setSummary({
          activeLoanId: data?.activeLoanId ?? null,
          currentSavings: Number(
            data?.currentSavings ?? data?.activeLoanSavings ?? 0,
          ),
          hasActiveLoan:
            data?.hasActiveLoan ?? Boolean(data?.activeLoanId ?? null),
        });
      })
      .catch((err: unknown) => {
        const message = axios.isAxiosError<{ message?: string | string[] }>(err)
          ? (err.response?.data?.message ??
            err.message ??
            "Unable to load savings information.")
          : err instanceof Error
            ? err.message
            : "Unable to load savings information.";
        setSummaryError(
          Array.isArray(message) ? (message[0] as string) : String(message),
        );
        setSummary({
          activeLoanId: null,
          currentSavings: 0,
          hasActiveLoan: false,
        });
      })
      .finally(() => {
        setSummaryLoading(false);
      });
  }, [open, member]);

  const handleSubmit = async () => {
    if (!member) {
      setError("No member selected.");
      return;
    }

    if (!hasActiveLoan || !summary?.activeLoanId) {
      setError("This member has no active loan to attach savings to.");
      return;
    }

    const numericAmount = Number.parseFloat(amount || "0");
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError("Savings amount must be greater than 0.");
      return;
    }

    if (isWithdraw && numericAmount > currentSavings) {
      setError("Withdrawal amount cannot exceed available savings.");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const payload = {
        memberId: member.id,
        loanId: summary.activeLoanId || undefined,
        amount: numericAmount,
      };

      const response = (
        isWithdraw
          ? await savingsService.withdraw(payload)
          : await savingsService.deposit(payload)
      ) as SavingsTransactionResponse;

      const updatedSavings =
        response?.loan?.savings ??
        (isWithdraw
          ? Math.max(currentSavings - numericAmount, 0)
          : currentSavings + numericAmount);
      const updatedLoanId = response?.loan?.id ?? summary.activeLoanId ?? null;

      setSummary({
        activeLoanId: updatedLoanId,
        currentSavings: updatedSavings,
        hasActiveLoan: true,
      });
      setSuccessMessage(
        isWithdraw
          ? "Savings withdrawal recorded successfully."
          : "Savings deposit recorded successfully.",
      );
      setAmount("");
      await queryClient.invalidateQueries(savingsHistoryKeys.member(member.id));
      onSuccess();
    } catch (err: unknown) {
      const message = axios.isAxiosError<{ message?: string | string[] }>(err)
        ? (err.response?.data?.message ??
          err.message ??
          `Unable to record savings ${isWithdraw ? "withdrawal" : "deposit"}. Please try again.`)
        : err instanceof Error
          ? err.message
          : `Unable to record savings ${isWithdraw ? "withdrawal" : "deposit"}. Please try again.`;
      setError(
        Array.isArray(message) ? (message[0] as string) : String(message),
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessMessage(null);
  };

  const disableSubmit =
    processing ||
    summaryLoading ||
    !amount.trim() ||
    Number.isNaN(previewAmount) ||
    previewAmount <= 0 ||
    !hasActiveLoan ||
    insufficientFunds;

  return (
    <>
      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={3000}
        onClose={handleSuccessClose}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={handleSuccessClose}
          severity="success"
          sx={{ width: "100%" }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
      <Dialog
        open={open && !historyOpen}
        onClose={onClose}
        maxWidth={false}
        scroll="paper"
        aria-labelledby="manage-savings-dialog-title"
        PaperProps={{
          sx: {
            width: "calc(100% - 32px)",
            maxWidth: 640,
            maxHeight: "calc(100dvh - 32px)",
            bgcolor: "background.paper",
            overflow: "hidden",
          },
        }}
      >
        <DialogTitle
          id="manage-savings-dialog-title"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            px: { xs: 2, sm: 3 },
            py: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Savings color="warning" />
            <Typography component="span" variant="h5">
              Manage Savings
            </Typography>
          </Box>
          <IconButton
            aria-label="Close savings form"
            onClick={onClose}
            sx={{ width: 44, height: 44 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 3, overflowY: "auto" }}>
          {summaryError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {summaryError}
            </Alert>
          )}

          {!summaryLoading && !hasActiveLoan && !summaryError ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This member does not currently have an active loan. Savings
              transactions require an active loan to attach funds to.
            </Alert>
          ) : null}

          {error && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <ToggleButtonGroup
              color="primary"
              value={mode}
              exclusive
              onChange={(_, value) => value && setMode(value)}
              sx={{ alignSelf: "center" }}
            >
              <ToggleButton
                value="deposit"
                disabled={summaryLoading || !hasActiveLoan}
              >
                Deposit
              </ToggleButton>
              <ToggleButton
                value="withdraw"
                disabled={summaryLoading || !hasActiveLoan}
              >
                Withdraw
              </ToggleButton>
            </ToggleButtonGroup>

            <Card
              variant="outlined"
              sx={{
                backgroundColor: "#fffbeb",
                borderColor: "#f59e0b",
              }}
            >
              <CardContent>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, color: "#92400e", mb: 1 }}
                >
                  Current Savings Balance
                </Typography>
                {summaryLoading ? (
                  <CircularProgress size={24} />
                ) : (
                  <Typography
                    variant="h4"
                    sx={{ fontWeight: 700, color: "#92400e" }}
                  >
                    {formatCurrency(currentSavings)}
                  </Typography>
                )}
                <Divider sx={{ my: 1.5, borderColor: "warning.light" }} />
                <Button
                  variant="text"
                  size="small"
                  startIcon={<History />}
                  endIcon={<ArrowForward />}
                  onClick={() => setHistoryOpen(true)}
                  disabled={summaryLoading || !member}
                  sx={{ px: 0, color: "primary.main" }}
                >
                  View Savings History
                </Button>
              </CardContent>
            </Card>

            <TextField
              label={isWithdraw ? "Withdrawal Amount" : "Deposit Amount"}
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              InputProps={{
                startAdornment: (
                  <Typography sx={{ mr: 1, color: "#6b7280" }}>₱</Typography>
                ),
              }}
              helperText={
                isWithdraw
                  ? insufficientFunds
                    ? "Withdrawal amount exceeds available savings."
                    : "Enter the amount to withdraw from the member's savings."
                  : "Enter the amount to add to the member's savings."
              }
              error={insufficientFunds}
              disabled={summaryLoading || !hasActiveLoan}
              fullWidth
              inputProps={{ min: 0, step: "0.01" }}
            />
            <Card variant="outlined" sx={{ backgroundColor: "#f8fafc" }}>
              <CardContent>
                <Typography variant="subtitle2" sx={{ color: "#64748b" }}>
                  Active Loan Overview
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" sx={{ color: "#1e293b" }}>
                  Loan Status:{" "}
                  <strong>{hasActiveLoan ? "Active" : "Not Available"}</strong>
                </Typography>
                <Typography variant="body2" sx={{ color: "#1e293b" }}>
                  Savings After Transaction:
                  <strong> {formatCurrency(projectedSavings)}</strong>
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </DialogContent>

        <DialogActions
          sx={{
            flexDirection: { xs: "column-reverse", sm: "row" },
            alignItems: "stretch",
            px: { xs: 2, sm: 3 },
            py: 2,
            gap: 1,
            borderTop: "1px solid",
            borderColor: "divider",
            "& > .MuiButton-root": {
              minHeight: 44,
              width: { xs: "100%", sm: "auto" },
              m: 0,
            },
          }}
        >
          <Button onClick={onClose} size="large">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="warning"
            size="large"
            aria-label={isWithdraw ? "Record withdrawal" : "Record deposit"}
            disabled={disableSubmit}
            startIcon={
              processing ? <CircularProgress size={18} /> : <Savings />
            }
          >
            {processing
              ? "Processing..."
              : mode === "withdraw"
                ? "Withdraw"
                : "Deposit"}
          </Button>
        </DialogActions>
      </Dialog>
      <SavingsHistoryDialog
        open={open && historyOpen}
        member={member}
        currentSavings={currentSavings}
        formatCurrency={formatCurrency}
        onClose={() => setHistoryOpen(false)}
      />
    </>
  );
}

export default SavingsDepositDialog;
