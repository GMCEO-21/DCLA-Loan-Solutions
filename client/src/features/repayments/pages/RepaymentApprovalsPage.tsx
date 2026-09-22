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
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircle from "@mui/icons-material/CheckCircle";
import Close from "@mui/icons-material/Close";
import Refresh from "@mui/icons-material/Refresh";
import Search from "@mui/icons-material/Search";
import OperationalTableLoadingSkeleton from "@components/common/OperationalTableLoadingSkeleton";
import PageHeader from "@components/common/PageHeader";
import RequestErrorAlert from "@components/common/RequestErrorAlert";
import DashboardLayout from "@components/layout/PrivateLayout";
import { smsNotificationsApi } from "@features/notifications/api";
import SendSmsConfirmationDialog from "@features/notifications/components/SendSmsConfirmationDialog";
import type { SmsEligibilityItem } from "@features/notifications/types";
import { useRepaymentApprovals } from "../hooks/useRepaymentApprovals";
import { repaymentsService } from "../api";
import type {
  PendingRepaymentCollectionGroup,
  RepaymentAllocationPreview,
} from "../types";

const formatCurrency = (value: number) =>
  `₱${Number(value || 0).toLocaleString()}`;

const formatDate = (value?: string | null) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const dialogPaperSx = {
  m: { xs: 2, sm: 4 },
  maxHeight: "calc(100dvh - 32px)",
};

const dialogActionsSx = {
  p: 2,
  gap: 1,
  flexDirection: { xs: "column-reverse", sm: "row" },
  "& > .MuiButton-root": {
    minHeight: 44,
    m: 0,
    width: { xs: "100%", sm: "auto" },
  },
};

export default function RepaymentApprovalsPage() {
  const {
    pendingCollections,
    loading,
    error,
    actingIds,
    getActionKey,
    refresh,
    approveCollection,
    rejectCollection,
  } = useRepaymentApprovals();

  const [search, setSearch] = useState("");
  const [approveTarget, setApproveTarget] =
    useState<PendingRepaymentCollectionGroup | null>(null);
  const [approveSubmitting, setApproveSubmitting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [allocationPreviews, setAllocationPreviews] = useState<
    RepaymentAllocationPreview[]
  >([]);
  const [rejectState, setRejectState] = useState<{
    open: boolean;
    target: PendingRepaymentCollectionGroup | null;
    reason: string;
  }>({ open: false, target: null, reason: "" });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });
  const [smsCandidates, setSmsCandidates] = useState<SmsEligibilityItem[]>([]);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return pendingCollections;

    return pendingCollections.filter((item) => {
      const centerName = (item.centerName || "").toLowerCase();
      const collectionDate = item.collectionDate || "";
      return centerName.includes(query) || collectionDate.includes(query);
    });
  }, [pendingCollections, search]);

  const totalPendingEntries = useMemo(
    () =>
      pendingCollections.reduce(
        (sum, item) => sum + Number(item.pendingCount || 0),
        0,
      ),
    [pendingCollections],
  );

  const showSnackbar = (
    message: string,
    severity: "success" | "error" = "success",
  ) => setSnackbar({ open: true, message, severity });

  const handleApprove = async () => {
    if (!approveTarget || approveSubmitting) return;

    setApproveSubmitting(true);
    try {
      const result = await approveCollection(
        approveTarget.centerId,
        approveTarget.collectionDate,
        approveTarget.batchId,
      );
      showSnackbar("Collection approved successfully.");
      if (result.approvedPaymentIds.length > 0) {
        try {
          const eligibility = await smsNotificationsApi.getRepaymentEligibility(
            result.approvedPaymentIds,
          );
          setSmsCandidates(eligibility);
          setSmsDialogOpen(true);
        } catch {
          showSnackbar(
            "Collection approved successfully. SMS options are temporarily unavailable.",
          );
        }
      }
    } catch {
      showSnackbar("Failed to approve collection.", "error");
    } finally {
      setApproveSubmitting(false);
      setApproveTarget(null);
      setAllocationPreviews([]);
    }
  };

  const handleOpenApprove = async (target: PendingRepaymentCollectionGroup) => {
    setApproveTarget(target);
    setAllocationPreviews([]);
    setPreviewLoading(true);
    try {
      const repayments = await repaymentsService.getPendingForCollection(
        target.centerId,
        target.collectionDate,
      );
      const paymentRepayments = repayments.filter(
        (repayment) => repayment.operationType !== "reversal",
      );
      const previews = await Promise.all(
        paymentRepayments.map((repayment) =>
          repaymentsService.getAllocationPreview(repayment.id),
        ),
      );
      setAllocationPreviews(previews);
    } catch {
      showSnackbar("Unable to load repayment allocation preview.", "error");
    } finally {
      setPreviewLoading(false);
    }
  };

  const closeRejectDialog = () =>
    setRejectState({ open: false, target: null, reason: "" });

  const handleReject = async () => {
    if (!rejectState.target) return;

    try {
      await rejectCollection(
        rejectState.target.centerId,
        rejectState.target.collectionDate,
        rejectState.reason,
        rejectState.target.batchId,
      );
      showSnackbar("Collection rejected.");
    } catch {
      showSnackbar("Failed to reject collection.", "error");
    } finally {
      closeRejectDialog();
    }
  };

  if (loading && pendingCollections.length === 0) {
    return (
      <DashboardLayout>
        <OperationalTableLoadingSkeleton
          actionWidth={110}
          filterCount={1}
          rowCount={8}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ minWidth: 0, maxWidth: "100%" }}>
        <PageHeader
          title="Approvals"
          description="Review and manage pending collection approvals."
          actions={
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={refresh}
              sx={{ minHeight: 44 }}
            >
              Refresh
            </Button>
          }
        />

        <Box
          role="group"
          aria-label="Approval filters"
          sx={{
            display: "flex",
            alignItems: { xs: "stretch", sm: "center" },
            flexDirection: { xs: "column", sm: "row" },
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
            label="Search approvals"
            placeholder="Search by center or date"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{
              width: { xs: "100%", sm: 360 },
              maxWidth: "100%",
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
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
              flexDirection: { xs: "column", sm: "row" },
              gap: 0.5,
              px: { xs: 2, sm: 3 },
              py: 2,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="h6">Pending collections</Typography>
            <Typography variant="body2" color="text.secondary">
              {filtered.length} collection{filtered.length === 1 ? "" : "s"}
              {" / "}
              {totalPendingEntries} pending entr
              {totalPendingEntries === 1 ? "y" : "ies"}
            </Typography>
          </Box>

          <TableContainer sx={{ maxWidth: "100%", overflowX: "auto" }}>
            <Table stickyHeader sx={{ minWidth: 1120 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Collection Date</TableCell>
                  <TableCell>Center</TableCell>
                  <TableCell align="right">Entries</TableCell>
                  <TableCell align="right">Payments</TableCell>
                  <TableCell align="right">Reversals</TableCell>
                  <TableCell align="right">Payment Total</TableCell>
                  <TableCell align="right">Reversal Total</TableCell>
                  <TableCell align="right">Net Total</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((item) => {
                  const isActing = actingIds.has(
                    getActionKey(
                      item.centerId,
                      item.collectionDate,
                      item.batchId,
                    ),
                  );

                  return (
                    <TableRow
                      key={`${item.batchId ?? "legacy"}-${item.centerId}-${item.collectionDate}`}
                      hover
                    >
                      <TableCell>{formatDate(item.collectionDate)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.centerName || "Unknown center"}
                        </Typography>
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {item.pendingCount}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {item.paymentCount}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {item.reversalCount}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatCurrency(item.paymentAmount)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatCurrency(item.reversalAmount)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                          color:
                            item.netAmount < 0 ? "error.main" : "text.primary",
                        }}
                      >
                        {formatCurrency(item.netAmount)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label="Pending"
                          color="warning"
                          variant="outlined"
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            justifyContent: "flex-end",
                          }}
                        >
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<CheckCircle />}
                            disabled={isActing}
                            onClick={() => void handleOpenApprove(item)}
                            sx={{ minHeight: 44 }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            disabled={isActing}
                            onClick={() =>
                              setRejectState({
                                open: true,
                                target: item,
                                reason: "",
                              })
                            }
                            sx={{ minHeight: 44 }}
                          >
                            Reject
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!error && !loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                      <Typography sx={{ fontWeight: 600 }}>
                        {search.trim()
                          ? "No pending approvals match your search."
                          : "No pending collection approvals."}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {search.trim()
                          ? "Adjust the search and try again."
                          : "New approval requests will appear here."}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      <Dialog
        open={Boolean(approveTarget)}
        onClose={() => {
          if (!approveSubmitting) setApproveTarget(null);
        }}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: dialogPaperSx }}
        aria-labelledby="approve-collection-dialog-title"
      >
        <DialogTitle
          id="approve-collection-dialog-title"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            pr: 1,
          }}
        >
          Approve collection
          <IconButton
            aria-label="Close approve dialog"
            disabled={approveSubmitting}
            onClick={() => setApproveTarget(null)}
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ overflowY: "auto" }}>
          <DialogContentText>
            This will approve all pending repayments for{" "}
            <strong>{approveTarget?.centerName || "Unknown center"}</strong> on{" "}
            <strong>{formatDate(approveTarget?.collectionDate)}</strong>.
          </DialogContentText>
          {previewLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : allocationPreviews.length > 0 ? (
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Loan</TableCell>
                    <TableCell align="right">Penalty</TableCell>
                    <TableCell align="right">PDI</TableCell>
                    <TableCell align="right">Loan</TableCell>
                    <TableCell align="right">Savings</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allocationPreviews.map((preview) => (
                    <TableRow key={preview.repaymentId}>
                      <TableCell>{preview.loanId.slice(0, 8)}...</TableCell>
                      <TableCell align="right">
                        {formatCurrency(preview.allocation.penalty.amount)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(
                          preview.allocation.pastDueInterest.amount,
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(preview.allocation.contractual.amount)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(preview.allocation.savingsUsed)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              No payment allocations in this collection.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button
            disabled={approveSubmitting}
            onClick={() => {
              setApproveTarget(null);
              setAllocationPreviews([]);
            }}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleApprove}
            disabled={approveSubmitting || previewLoading}
            startIcon={
              approveSubmitting ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            {approveSubmitting ? "Approving..." : "Approve Collection"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={rejectState.open}
        onClose={closeRejectDialog}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: dialogPaperSx }}
        aria-labelledby="reject-collection-dialog-title"
      >
        <DialogTitle
          id="reject-collection-dialog-title"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            pr: 1,
          }}
        >
          Reject collection
          <IconButton
            aria-label="Close reject dialog"
            onClick={closeRejectDialog}
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ overflowY: "auto" }}>
          <DialogContentText sx={{ mb: 2 }}>
            This will reject all pending repayments in the selected collection.
            Add a reason to help cashier correction.
          </DialogContentText>
          <TextField
            fullWidth
            label="Rejection reason (optional)"
            value={rejectState.reason}
            onChange={(event) =>
              setRejectState((previous) => ({
                ...previous,
                reason: event.target.value,
              }))
            }
            multiline
            minRows={3}
          />
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={closeRejectDialog} color="inherit">
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={handleReject}>
            Reject Collection
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() =>
          setSnackbar((previous) => ({ ...previous, open: false }))
        }
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() =>
            setSnackbar((previous) => ({ ...previous, open: false }))
          }
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <SendSmsConfirmationDialog
        open={smsDialogOpen}
        eventType="repayment_posted"
        title={`${smsCandidates.length} Payment${smsCandidates.length === 1 ? "" : "s"} Successfully Approved`}
        candidates={smsCandidates}
        onClose={() => setSmsDialogOpen(false)}
      />
    </DashboardLayout>
  );
}
