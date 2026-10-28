import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import Search from "@mui/icons-material/Search";
import Close from "@mui/icons-material/Close";
import type { SelectChangeEvent } from "@mui/material/Select";
import OperationalTableLoadingSkeleton from "@components/common/OperationalTableLoadingSkeleton";
import PageHeader from "@components/common/PageHeader";
import RequestErrorAlert from "@components/common/RequestErrorAlert";
import DashboardLayout from "@components/layout/PrivateLayout";
import { useAuthStore } from "@features/auth/authStore";
import { repaymentsService } from "@features/repayments/api";
import { formatRecordedTimestamp } from "@utils/dateTime";
import { useTransactionHistory } from "../hooks/useTransactionHistory";
import type {
  TransactionFilterType,
  TransactionHistoryItem,
  TransactionType,
} from "../types";

const typeOptions = [
  { value: "all", label: "All Transactions" },
  { value: "repayment", label: "Loan Repayments & Reversals" },
  { value: "savings_deposit", label: "Savings Deposit" },
  { value: "savings_withdrawal", label: "Savings Withdrawal" },
];

const typeLabels: Record<TransactionType, string> = {
  repayment: "Loan Repayment",
  savings_deposit: "Savings Deposit",
  savings_withdrawal: "Savings Withdrawal",
};

const getTransactionLabel = (
  transaction: Pick<TransactionHistoryItem, "type" | "repaymentOperationType">,
) =>
  transaction.type === "repayment" &&
  transaction.repaymentOperationType === "reversal"
    ? "Repayment Reversal"
    : typeLabels[transaction.type];

const formatCurrency = (value: number) =>
  `₱${Number(value || 0).toLocaleString()}`;

const dialogPaperSx = {
  m: { xs: 2, sm: 4 },
  maxHeight: "calc(100dvh - 32px)",
};

export default function TransactionHistoryPage() {
  const theme = useTheme();
  const compactPagination = useMediaQuery(theme.breakpoints.down("sm"));
  const role = useAuthStore((state) => state.user?.role ?? "");
  const {
    transactions,
    loading,
    error,
    page,
    limit,
    totalPages,
    total,
    filters,
    setPage,
    setLimit,
    updateFilters,
    refresh,
  } = useTransactionHistory(25);
  const [reversalDialog, setReversalDialog] = useState<{
    open: boolean;
    repaymentId: string | null;
    reason: string;
  }>({ open: false, repaymentId: null, reason: "" });
  const [submittingReversal, setSubmittingReversal] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const stats = useMemo(
    () =>
      transactions.reduce(
        (acc, transaction) => {
          if (transaction.type === "repayment") {
            if (transaction.repaymentOperationType === "reversal") {
              acc.reversals += 1;
            } else {
              acc.repayments += 1;
            }
          }
          if (transaction.type === "savings_deposit") acc.deposits += 1;
          if (transaction.type === "savings_withdrawal") acc.withdrawals += 1;
          return acc;
        },
        { repayments: 0, reversals: 0, deposits: 0, withdrawals: 0 },
      ),
    [transactions],
  );

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.type !== "all" ||
    filters.startDate ||
    filters.endDate,
  );
  const isOperationalAdmin = role === "admin";
  const canRequestReversal = role === "cashier" || isOperationalAdmin;

  const showSnackbar = (
    message: string,
    severity: "success" | "error" = "success",
  ) => setSnackbar({ open: true, message, severity });

  const handleLimitChange = (event: SelectChangeEvent) => {
    const newLimit = Number(event.target.value);
    setLimit(newLimit);
    setPage(1);
  };

  const handleOpenReversalDialog = (repaymentId: string) => {
    setReversalDialog({ open: true, repaymentId, reason: "" });
  };

  const handleCloseReversalDialog = () => {
    if (submittingReversal) return;
    setReversalDialog({ open: false, repaymentId: null, reason: "" });
  };

  const handleSubmitReversalRequest = async () => {
    if (!reversalDialog.repaymentId) return;
    setSubmittingReversal(true);
    try {
      await repaymentsService.requestReversal(
        reversalDialog.repaymentId,
        reversalDialog.reason.trim() || undefined,
      );
      showSnackbar(
        isOperationalAdmin
          ? "Payment reversed successfully."
          : "Reversal request submitted for manager approval.",
      );
      handleCloseReversalDialog();
      await refresh();
    } catch {
      showSnackbar(
        isOperationalAdmin
          ? "Failed to reverse payment."
          : "Failed to submit reversal request.",
        "error",
      );
    } finally {
      setSubmittingReversal(false);
    }
  };

  if (loading && transactions.length === 0) {
    return (
      <DashboardLayout>
        <OperationalTableLoadingSkeleton filterCount={4} rowCount={8} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ minWidth: 0, maxWidth: "100%" }}>
        <PageHeader
          title="Transaction History"
          description="Review financial transaction activity and history."
        />

        <Box
          role="group"
          aria-label="Transaction filters"
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "minmax(260px, 1.5fr) minmax(190px, 1fr) minmax(170px, 0.8fr) minmax(170px, 0.8fr)",
            },
            gap: 2,
            mb: 3,
            pb: 3,
            borderBottom: "1px solid",
            borderColor: "divider",
            minWidth: 0,
          }}
        >
          <TextField
            size="small"
            label="Search transactions"
            placeholder="Search by member or center"
            value={filters.search}
            onChange={(event) => updateFilters({ search: event.target.value })}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{
              minWidth: 0,
              "& .MuiOutlinedInput-root": {
                minHeight: 44,
                bgcolor: "background.paper",
              },
            }}
          />

          <FormControl
            size="small"
            sx={{
              minWidth: 0,
              "& .MuiOutlinedInput-root": {
                minHeight: 44,
                bgcolor: "background.paper",
              },
            }}
          >
            <InputLabel id="transaction-type-label">
              Transaction type
            </InputLabel>
            <Select
              labelId="transaction-type-label"
              label="Transaction type"
              value={filters.type}
              onChange={(event) =>
                updateFilters({
                  type: event.target.value as TransactionFilterType | "all",
                })
              }
            >
              {typeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="Start date"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={filters.startDate}
            onChange={(event) =>
              updateFilters({ startDate: event.target.value })
            }
            sx={{
              minWidth: 0,
              "& .MuiOutlinedInput-root": {
                minHeight: 44,
                bgcolor: "background.paper",
              },
            }}
          />

          <TextField
            size="small"
            label="End date"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={filters.endDate}
            onChange={(event) => updateFilters({ endDate: event.target.value })}
            sx={{
              minWidth: 0,
              "& .MuiOutlinedInput-root": {
                minHeight: 44,
                bgcolor: "background.paper",
              },
            }}
          />
        </Box>

        {error && <RequestErrorAlert message={error} onRetry={refresh} />}

        <Paper
          elevation={0}
          sx={{
            minWidth: 0,
            maxWidth: "100%",
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "background.paper",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: { xs: "flex-start", md: "center" },
              justifyContent: "space-between",
              flexDirection: { xs: "column", md: "row" },
              gap: 1.5,
              px: { xs: 2, sm: 3 },
              py: 2,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Box>
              <Typography variant="h6">Transactions</Typography>
              <Typography variant="body2" color="text.secondary">
                {transactions.length.toLocaleString()} shown of{" "}
                {total.toLocaleString()} records
              </Typography>
            </Box>

            <Stack
              direction="row"
              spacing={{ xs: 1.5, sm: 2.5 }}
              useFlexGap
              flexWrap="wrap"
              aria-label="Current page transaction summary"
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontWeight: 600 }}
              >
                Current page:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Repayments: <strong>{stats.repayments}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Reversals: <strong>{stats.reversals}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Deposits: <strong>{stats.deposits}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Withdrawals: <strong>{stats.withdrawals}</strong>
              </Typography>
            </Stack>
          </Box>

          <TableContainer sx={{ maxWidth: "100%", overflowX: "auto" }}>
            <Table
              stickyHeader
              sx={{ minWidth: canRequestReversal ? 1040 : 870 }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 180 }}>Date &amp; Time</TableCell>
                  <TableCell sx={{ minWidth: 190 }}>Member</TableCell>
                  <TableCell sx={{ minWidth: 200 }}>Center</TableCell>
                  <TableCell sx={{ width: 190 }}>Transaction</TableCell>
                  <TableCell align="right" sx={{ width: 130 }}>
                    Amount
                  </TableCell>
                  {canRequestReversal && (
                    <TableCell align="right" sx={{ width: 170 }}>
                      Actions
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((transaction) => {
                  const savingsAppliedToRepayment =
                    transaction.type === "savings_withdrawal" &&
                    (transaction.notes || "")
                      .toLowerCase()
                      .includes("applied to repayment");
                  const isRepaymentPayment =
                    transaction.type === "repayment" &&
                    transaction.direction === "credit" &&
                    (transaction.repaymentOperationType ?? "payment") ===
                      "payment";
                  const showReversalAction =
                    canRequestReversal &&
                    isRepaymentPayment &&
                    transaction.canReverse === true;

                  return (
                    <TableRow key={transaction.id} hover>
                      <TableCell sx={{ width: 180, whiteSpace: "nowrap" }}>
                        {formatRecordedTimestamp(transaction.createdAt)}
                      </TableCell>
                      <TableCell sx={{ minWidth: 190 }}>
                        <Typography noWrap sx={{ fontWeight: 600 }}>
                          {transaction.member.name}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 200 }}>
                        {transaction.member.center?.name ?? "No center"}
                      </TableCell>
                      <TableCell sx={{ width: 190 }}>
                        <Chip
                          label={getTransactionLabel(transaction)}
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          width: 130,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatCurrency(transaction.amount)}
                        {savingsAppliedToRepayment && (
                          <Typography variant="body2" color="text.secondary">
                            Used for repayment
                          </Typography>
                        )}
                      </TableCell>
                      {canRequestReversal && (
                        <TableCell align="right" sx={{ width: 170 }}>
                          {showReversalAction ? (
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              onClick={() =>
                                handleOpenReversalDialog(transaction.id)
                              }
                              sx={{ minHeight: 44, whiteSpace: "nowrap" }}
                            >
                              {isOperationalAdmin
                                ? "Reverse Payment"
                                : "Request Reversal"}
                            </Button>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}

                {!loading && !error && transactions.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={canRequestReversal ? 6 : 5}
                      align="center"
                      sx={{ py: 8 }}
                    >
                      <Typography sx={{ fontWeight: 600 }}>
                        {hasActiveFilters
                          ? "No transactions match the selected filters."
                          : "No transaction history is available."}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {hasActiveFilters
                          ? "Adjust the search, type, or date range and try again."
                          : "Recorded repayments and savings activity will appear here."}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {loading && transactions.length > 0 && (
            <Box
              role="status"
              aria-label="Updating transactions"
              sx={{ py: 2, display: "flex", justifyContent: "center" }}
            >
              <CircularProgress size={24} />
            </Box>
          )}

          <Box
            sx={{
              display: "flex",
              alignItems: { xs: "stretch", sm: "center" },
              justifyContent: "space-between",
              flexDirection: { xs: "column", sm: "row" },
              gap: 2,
              px: { xs: 2, sm: 3 },
              py: 2,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <Pagination
              count={totalPages}
              page={page}
              shape="rounded"
              color="primary"
              size={compactPagination ? "small" : "medium"}
              siblingCount={compactPagination ? 0 : 1}
              onChange={(_, value) => setPage(value)}
              aria-label="Transaction pages"
              sx={{
                alignSelf: { xs: "center", sm: "auto" },
                maxWidth: "100%",
                "& .MuiPagination-ul": { flexWrap: "nowrap" },
              }}
            />

            <FormControl
              size="small"
              sx={{
                width: { xs: "100%", sm: 160 },
                "& .MuiOutlinedInput-root": { minHeight: 44 },
              }}
            >
              <InputLabel id="page-size-label">Rows per page</InputLabel>
              <Select
                labelId="page-size-label"
                label="Rows per page"
                value={String(limit)}
                onChange={handleLimitChange}
              >
                {[10, 25, 50, 100].map((size) => (
                  <MenuItem key={size} value={size}>
                    {size}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Paper>

        <Dialog
          open={reversalDialog.open}
          onClose={handleCloseReversalDialog}
          fullWidth
          maxWidth="xs"
          PaperProps={{ sx: dialogPaperSx }}
          aria-labelledby="repayment-reversal-dialog-title"
        >
          <DialogTitle
            id="repayment-reversal-dialog-title"
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              pr: 1,
            }}
          >
            <span>
              {isOperationalAdmin
                ? "Reverse repayment"
                : "Request repayment reversal"}
            </span>
            <IconButton
              aria-label="Close reversal dialog"
              disabled={submittingReversal}
              onClick={handleCloseReversalDialog}
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ overflowY: "auto" }}>
            <DialogContentText sx={{ mb: 2 }}>
              {isOperationalAdmin
                ? "This payment will be reversed immediately."
                : "This request will stay pending until a manager approves it."}
            </DialogContentText>
            <TextField
              fullWidth
              label="Reason (optional)"
              value={reversalDialog.reason}
              onChange={(event) =>
                setReversalDialog((prev) => ({
                  ...prev,
                  reason: event.target.value,
                }))
              }
              multiline
              minRows={2}
            />
          </DialogContent>
          <DialogActions
            sx={{
              p: { xs: 2, sm: 3 },
              gap: 1,
              flexDirection: { xs: "column-reverse", sm: "row" },
              "& .MuiButton-root": { width: { xs: "100%", sm: "auto" } },
            }}
          >
            <Button
              onClick={handleCloseReversalDialog}
              disabled={submittingReversal}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleSubmitReversalRequest}
              disabled={submittingReversal}
            >
              {submittingReversal
                ? isOperationalAdmin
                  ? "Reversing..."
                  : "Submitting..."
                : isOperationalAdmin
                  ? "Reverse Payment"
                  : "Submit Request"}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
            severity={snackbar.severity}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}
