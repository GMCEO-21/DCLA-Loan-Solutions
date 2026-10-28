import { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Paper,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { Add, Calculate } from "@mui/icons-material";
import type { LoanFormData, LoanCalculation } from "../types";
import { calculateLoanDetails, formatCurrency, formatPercentage } from "../utils/loanCalculations";

interface LoanFormProps {
  memberId: string;
  memberName: string;
  onSubmit: (data: LoanFormData) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  isFirstLoan?: boolean;
}

export default function LoanForm({
  memberName,
  onSubmit,
  onCancel,
  loading = false,
  isFirstLoan = false,
}: LoanFormProps) {
  const [formData, setFormData] = useState<LoanFormData>({
    principalAmount: 0,
    termWeeks: 8,
    savings: undefined,
    loanCreatedDate: new Date(),
  });

  const [calculation, setCalculation] = useState<LoanCalculation | null>(null);
  type LoanFormErrors = Partial<
    Record<keyof LoanFormData, string>
  >;
  const [errors, setErrors] = useState<LoanFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serviceCharge, setServiceCharge] = useState<number>(0);
  const [notarialFee, setNotarialFee] = useState<number>(0);
  const [useCustomDate, setUseCustomDate] = useState<boolean>(false);

  // Calculate loan details when form data changes
  useEffect(() => {
    if (formData.principalAmount > 0) {
      const calc = calculateLoanDetails(
        formData.principalAmount,
        formData.termWeeks,
        formData.monthlyInterestRate,
      );
      setCalculation(calc);
    } else {
      setCalculation(null);
    }
  }, [formData.principalAmount, formData.termWeeks, formData.monthlyInterestRate]);

  const handleInputChange =
    (field: "principalAmount" | "savings") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;

      setFormData((prev) => {
        if (field === "principalAmount") {
          const numeric = Number(rawValue);
          const cleaned = Number.isNaN(numeric) ? 0 : numeric;
          return {
            ...prev,
            principalAmount: cleaned,
          };
        }

        const numeric = rawValue === "" ? undefined : Number(rawValue);
        const cleaned =
          numeric === undefined || Number.isNaN(numeric)
            ? undefined
            : numeric;
        return {
          ...prev,
          savings: cleaned,
        };
      });

      if (errors[field]) {
        setErrors((prev) => ({
          ...prev,
          [field]: undefined,
        }));
      }

      if (submitError) {
        setSubmitError(null);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: LoanFormErrors = {};
    if (!formData.principalAmount || formData.principalAmount <= 0) {
      newErrors.principalAmount = "Principal amount must be greater than 0";
    }
    const savingsForValidation = Number(formData.savings || 0);
    if (isFirstLoan && savingsForValidation <= 0) {
      newErrors.savings =
        "Savings contribution must be greater than 0 for first loan";
    }
    if (
      formData.termWeeks === 24 &&
      (!formData.monthlyInterestRate ||
        formData.monthlyInterestRate < 3.33 ||
        formData.monthlyInterestRate > 10)
    ) {
      (newErrors as any).monthlyInterestRate =
        "Monthly interest rate must be between 3.33% and 10%";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const savingsContribution = Math.max(0, Number(formData.savings || 0));

      await onSubmit({
        ...formData,
        savings: savingsContribution,
        serviceCharge,
        notarialFee,
      });
    } catch (err) {
      console.error("Failed to create loan:", err);
      setSubmitError("Failed to create loan. Please try again.");
    }
  };

  // Compute net cash released preview for new loan
  const savingsAmount = Math.max(0, Number(formData.savings || 0));
  const savingsDeduction = savingsAmount;
  const netCashReleased = Math.max(
    0,
      Number(formData.principalAmount || 0) -
      Number(serviceCharge || 0) -
      Number(notarialFee || 0) -
      savingsDeduction
  );

  return (
    <Paper
      sx={{
        p: 4,
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        border: "1px solid #e2e8f0",
      }}
    >
      <Typography
        variant="h5"
        gutterBottom
        sx={{
          fontWeight: 600,
          color: "#1e293b",
          mb: 3,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Add />
        Create Loan - {memberName}
      </Typography>

      {submitError && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {submitError}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6} className="test">
            <TextField
              fullWidth
              label="Principal Amount"
              type="number"
              value={formData.principalAmount || ""}
              onChange={handleInputChange("principalAmount")}
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*", min: 0 }}
              error={Boolean(errors.principalAmount)}
              helperText={errors.principalAmount}
              disabled={loading}
              required
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>₱</Typography>,
              }}
            />
          </Grid>

          {/* Savings Amount (manual input) */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Savings Amount"
              type="number"
              value={formData.savings ?? ""}
              onChange={handleInputChange("savings")}
              
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              error={Boolean(errors.savings)}
              helperText={errors.savings}
              onWheel={(e) => e.currentTarget.blur()}
              disabled={loading}
              required={isFirstLoan}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>₱</Typography>,
              }}
            />
          </Grid>

          {/* Service Charge */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Service Charge"
              type="number"
              value={serviceCharge || ""}
              onChange={(e) => {
                const value = e.target.value;
                setServiceCharge(value === "" ? 0 : Number(value));
              }}

              inputProps={{ inputMode: "numeric", pattern: "[0-9]*", min: 0 }}
              onWheel={(e) => e.currentTarget.blur()}
              disabled={loading}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>₱</Typography>,
              }}
            />
          </Grid>

          {/* Notarial Fee */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Notarial Fee"
              type="number"
              value={notarialFee || ""}
              onChange={(e) => {
                const value = e.target.value;
                setNotarialFee(value === "" ? 0 : Number(value));
              }}
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*", min: 0 }}
              onWheel={(e) => e.currentTarget.blur()}
              disabled={loading}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>₱</Typography>,
              }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth disabled={loading}>
              <InputLabel>Term</InputLabel>
              <Select
                value={formData.termWeeks}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    termWeeks: e.target.value as 4 | 8 | 12 | 24,
                    monthlyInterestRate:
                      Number(e.target.value) === 24
                        ? prev.monthlyInterestRate
                        : undefined,
                  }));
                }}
                label="Term"
              >
                <MenuItem value={4}>4 weeks (10% interest)</MenuItem>
                <MenuItem value={8}>8 weeks (20% interest)</MenuItem>
                <MenuItem value={12}>12 weeks (30% interest)</MenuItem>
                <MenuItem value={24}>24 weeks (monthly interest)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {formData.termWeeks === 24 && (
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label="Monthly Interest Rate (%)"
                type="number"
                value={formData.monthlyInterestRate ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    monthlyInterestRate: value === "" ? undefined : Number(value),
                  }));
                }}
                inputProps={{ min: 3.33, max: 10, step: 0.01 }}
                error={Boolean((errors as any).monthlyInterestRate)}
                helperText={(errors as any).monthlyInterestRate || "Enter 3.33% to 10% per month"}
                disabled={loading}
              />
            </Grid>
          )}

          {/* Loan Creation Date */}
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={useCustomDate}
                  onChange={(e) => {
                    setUseCustomDate(e.target.checked);
                    if (!e.target.checked) {
                      setFormData(prev => ({ ...prev, loanCreatedDate: new Date() }));
                    }
                  }}
                  disabled={loading}
                />
              }
              label="Set custom loan creation date"
            />
            {useCustomDate && (
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Loan Creation Date"
                    value={formData.loanCreatedDate}
                    onChange={(newValue) => {
                      if (newValue) {
                        setFormData(prev => ({ ...prev, loanCreatedDate: newValue }));
                      }
                    }}
                    maxDate={new Date()} // Cannot be in the future
                    minDate={new Date(new Date().getFullYear() - 2, 0, 1)} // Max 2 years ago
                    disabled={loading}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        helperText: "When was this loan originally given to the member?",
                      },
                    }}
                  />
                </LocalizationProvider>
            )}
          </Grid>

          {/* Loan Calculation Preview */}
          {calculation && (
            <>
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" sx={{ mb: 2, color: "#1e293b" }}>
                  <Calculate sx={{ mr: 1, verticalAlign: "middle" }} />
                  Loan Calculation
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper
                  sx={{
                    p: 2,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Interest Rate
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: "#1e293b" }}>
                    {formatPercentage(calculation.interestRate)}
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper
                  sx={{
                    p: 2,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Interest
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: "#1e293b" }}>
                    {formatCurrency(calculation.totalInterest)}
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper
                  sx={{
                    p: 2,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Amount
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: "#1e293b" }}>
                    {formatCurrency(calculation.totalAmount)}
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper
                  sx={{
                    p: 2,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Weekly Payment
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: "#1e293b" }}>
                    {formatCurrency(calculation.weeklyPaymentAmount)}
                  </Typography>
                </Paper>
              </Grid>

              {/* Removed auto 10% savings preview */}

              {/* Net Cash Released Preview */}
              <Grid item xs={12}>
                <Paper
                  sx={{
                    p: 2,
                    backgroundColor: "#f0f9ff",
                    border: "2px solid #3b82f6",
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 700, color: "#1e293b" }}>
                    <Calculate sx={{ mr: 1, verticalAlign: "middle", color: "#3b82f6" }} />
                    Net Cash Released (Preview)
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 1 }}>
                    <Grid item xs={12} md={3}>
                      <Typography variant="body2" color="text.secondary">New Principal:</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>{formatCurrency(Number(formData.principalAmount || 0))}</Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Typography variant="body2" color="text.secondary">Less: Service Charge:</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: "#f59e0b" }}>-{formatCurrency(Number(serviceCharge || 0))}</Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Typography variant="body2" color="text.secondary">Less: Notarial Fee:</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: "#f59e0b" }}>-{formatCurrency(Number(notarialFee || 0))}</Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Typography variant="body2" color="text.secondary">Less: Savings Deducted:</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: "#f59e0b" }}>-{formatCurrency(savingsDeduction)}</Typography>
                    </Grid>
                  </Grid>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Net Cash to be Released:</Typography>
                    <Typography
                      variant="h5"
                      sx={{ fontWeight: 800, color: netCashReleased > 0 ? "#10b981" : "#ef4444" }}
                    >
                      {formatCurrency(netCashReleased)}
                    </Typography>
                    {netCashReleased <= 0 && (
                      <Typography variant="caption" color="error.main">No cash will be released with current configuration</Typography>
                    )}
                  </Box>
                </Paper>
              </Grid>
            </>
          )}

          <Grid item xs={12}>
            <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
              <Button
                variant="outlined"
                onClick={onCancel}
                disabled={loading}
                sx={{
                  borderColor: "#64748b",
                  color: "#64748b",
                  "&:hover": {
                    borderColor: "#475569",
                    backgroundColor: "#f8fafc",
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading || !calculation}
                startIcon={
                  loading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <Add />
                  )
                }
                sx={{
                  minWidth: 140,
                  background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
                  "&:hover": {
                    background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)",
                  },
                }}
              >
                {loading ? "Creating..." : "Create Loan"}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
} 
