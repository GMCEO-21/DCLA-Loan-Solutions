import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
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
import { Close, History, Percent, Refresh, Sync } from "@mui/icons-material";
import DashboardLayout from "@components/layout/PrivateLayout";
import PageLoadingSkeleton from "@components/common/PageLoadingSkeleton";
import { LoansAPI } from "../api";
import type {
  ApplyLoanWaiverPayload,
  LoanWaiver,
  LoanWaiverCandidate,
} from "../types";

const formatCurrency = (value: number) =>
  `PHP ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDateTime = (value?: string | null) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const getBorrowerName = (entry: LoanWaiverCandidate) =>
  [entry.borrower?.lastName, entry.borrower?.firstName]
    .filter(Boolean)
    .join(", ");

export default function LoanWaiversPage() {
  const [candidates, setCandidates] = useState<LoanWaiverCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [selected, setSelected] = useState<LoanWaiverCandidate | null>(null);
  const [form, setForm] = useState({
    pastDueInterestWaiver: "",
    penaltyWaiver: "",
    reason: "",
  });
  const [historyState, setHistoryState] = useState<{
    open: boolean;
    loading: boolean;
    target: LoanWaiverCandidate | null;
    rows: LoanWaiver[];
  }>({
    open: false,
    loading: false,
    target: null,
    rows: [],
  });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const showSnackbar = useCallback(
    (message: string, severity: "success" | "error" = "success") => {
      setSnackbar({ open: true, message, severity });
    },
    [],
  );

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await LoansAPI.getWaiverCandidates();
      setCandidates(data);
    } catch {
      setError("Failed to load waiver candidates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCandidates();
  }, [fetchCandidates]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return candidates;
    return candidates.filter((entry) => {
      const borrowerName = getBorrowerName(entry).toLowerCase();
      return (
        borrowerName.includes(query) ||
        entry.borrower?.id?.toLowerCase().includes(query) ||
        entry.id.toLowerCase().includes(query)
      );
    });
  }, [candidates, search]);

  const closeWaiverDialog = () => {
    setSelected(null);
    setForm({ pastDueInterestWaiver: "", penaltyWaiver: "", reason: "" });
  };

  const closeHistoryDialog = () => {
    setHistoryState({ open: false, loading: false, target: null, rows: [] });
  };

  const openWaiverDialog = (entry: LoanWaiverCandidate) => {
    setSelected(entry);
    setForm({
      pastDueInterestWaiver: "",
      penaltyWaiver: "",
      reason: "",
    });
  };

  const handleApplyWaiver = async () => {
    if (!selected) return;

    const pastDueInterestWaiver = Number(form.pastDueInterestWaiver || 0);
    const penaltyWaiver = Number(form.penaltyWaiver || 0);

    if (pastDueInterestWaiver <= 0 && penaltyWaiver <= 0) {
      showSnackbar("Enter at least one waiver amount greater than 0.", "error");
      return;
    }

    if (pastDueInterestWaiver > selected.pastDueInterestOutstanding) {
      showSnackbar(
        "Past due interest waiver exceeds outstanding amount.",
        "error",
      );
      return;
    }

    if (penaltyWaiver > selected.penaltyOutstanding) {
      showSnackbar("Penalty waiver exceeds outstanding amount.", "error");
      return;
    }

    const payload: ApplyLoanWaiverPayload = {
      pastDueInterestWaiver: pastDueInterestWaiver || undefined,
      penaltyWaiver: penaltyWaiver || undefined,
      reason: form.reason.trim() || undefined,
    };

    setSubmitting(true);
    try {
      await LoansAPI.applyWaiver(selected.id, payload);
      showSnackbar("Waiver applied successfully.");
      closeWaiverDialog();
      await fetchCandidates();
    } catch {
      showSnackbar("Failed to apply waiver.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenHistory = async (entry: LoanWaiverCandidate) => {
    setHistoryState({
      open: true,
      loading: true,
      target: entry,
      rows: [],
    });
    try {
      const rows = await LoansAPI.getLoanWaivers(entry.id);
      setHistoryState((prev) => ({ ...prev, loading: false, rows }));
    } catch {
      setHistoryState((prev) => ({ ...prev, loading: false, rows: [] }));
      showSnackbar("Failed to load waiver history.", "error");
    }
  };

  const handleRunSweep = async () => {
    if (sweeping) return;
    setSweeping(true);
    try {
      const response = await LoansAPI.runChargeSweep();
      if (!response.acquired || !response.result) {
        showSnackbar("A charge sweep is already running.", "error");
        return;
      }
      showSnackbar(
        `Sweep complete: ${response.result.chargeCount} charge event(s), ${response.result.failedCount} failure(s).`,
        response.result.failedCount > 0 ? "error" : "success",
      );
      await fetchCandidates();
    } catch {
      showSnackbar("Failed to run charge sweep.", "error");
    } finally {
      setSweeping(false);
    }
  };

  if (loading && candidates.length === 0) {
    return (
      <DashboardLayout>
        <PageLoadingSkeleton showStats={false} filterCount={2} rowCount={8} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ backgroundColor: "#f8fafc", minHeight: "100vh" }}>
        <Paper
          sx={{
            background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
            border: "1px solid #e2e8f0",
            borderRadius: 3,
            p: 4,
            mb: 3,
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
          }}
        >
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            gap={2}
            flexWrap="wrap"
          >
            <Box display="flex" alignItems="center" gap={3}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                  background:
                    "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 14px 0 rgba(59, 130, 246, 0.3)",
                }}
              >
                <Percent sx={{ fontSize: 28, color: "white" }} />
              </Box>
              <Box>
                <Typography variant="h4" fontWeight="bold" color="#1e293b">
                  Waiver Management
                </Typography>
                <Typography variant="body1" color="#64748b">
                  Manager-only waivers for penalties and past due interest.
                </Typography>
              </Box>
            </Box>

            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              <Chip
                label={`${candidates.length} loans with outstanding charges`}
                color="warning"
                sx={{ fontWeight: 600 }}
              />
              <TextField
                size="small"
                placeholder="Search borrower or loan ID"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                sx={{
                  minWidth: 260,
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "white",
                    borderRadius: 2,
                  },
                }}
              />
              <Button
                variant="outlined"
                startIcon={<Sync />}
                disabled={sweeping}
                onClick={() => void handleRunSweep()}
                sx={{ borderRadius: 2, px: 3, py: 1.5, fontWeight: 600 }}
              >
                {sweeping ? "Running Sweep..." : "Run Charge Sweep"}
              </Button>
              <Button
                variant="contained"
                startIcon={<Refresh />}
                onClick={() => void fetchCandidates()}
                sx={{
                  background:
                    "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
                  borderRadius: 2,
                  px: 3,
                  py: 1.5,
                  textTransform: "none",
                  fontWeight: 600,
                  boxShadow: "0 4px 14px 0 rgba(59, 130, 246, 0.3)",
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    boxShadow: "0 6px 20px 0 rgba(59, 130, 246, 0.4)",
                  },
                }}
              >
                Refresh
              </Button>
            </Box>
          </Box>
        </Paper>

        {error && (
          <Box px={3}>
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          </Box>
        )}

        <Box px={3}>
          <Paper
            sx={{
              borderRadius: 3,
              border: "1px solid #e2e8f0",
              boxShadow:
                "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
              overflow: "hidden",
            }}
          >
            <TableContainer>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Borrower</TableCell>
                    <TableCell>Loan ID</TableCell>
                    <TableCell align="right">Balance</TableCell>
                    <TableCell align="right">Past Due Interest</TableCell>
                    <TableCell align="right">Penalty</TableCell>
                    <TableCell align="right">Total Outstanding</TableCell>
                    <TableCell>Last Updated</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((entry) => (
                    <TableRow key={entry.id} hover>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600 }}>
                          {getBorrowerName(entry) || "Unknown borrower"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {entry.borrower?.id}
                        </Typography>
                      </TableCell>
                      <TableCell>{entry.id}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(entry.balance)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(entry.pastDueInterestOutstanding)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(entry.penaltyOutstanding)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(entry.totalOutstanding)}
                      </TableCell>
                      <TableCell>{formatDateTime(entry.updatedAt)}</TableCell>
                      <TableCell align="right">
                        <Box display="flex" gap={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<History />}
                            onClick={() => void handleOpenHistory(entry)}
                            sx={{ textTransform: "none", fontWeight: 600 }}
                          >
                            History
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => openWaiverDialog(entry)}
                            sx={{
                              textTransform: "none",
                              fontWeight: 600,
                              background:
                                "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                              "&:hover": {
                                background:
                                  "linear-gradient(135deg, #059669 0%, #047857 100%)",
                              },
                            }}
                          >
                            Apply Waiver
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loading && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No loans currently have outstanding penalties or past
                          due interest to waive.
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
          open={Boolean(selected)}
          onClose={closeWaiverDialog}
          maxWidth="sm"
          fullWidth
          aria-labelledby="apply-waiver-dialog-title"
        >
          <DialogTitle
            id="apply-waiver-dialog-title"
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Typography component="span" variant="h5">
              Apply Waiver
            </Typography>
            <IconButton
              aria-label="Close apply waiver dialog"
              onClick={closeWaiverDialog}
              sx={{ width: 44, height: 44 }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Enter the waiver amounts for the selected loan.
            </DialogContentText>

            {selected && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  mb: 2,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Borrower: {getBorrowerName(selected)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Loan ID: {selected.id}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Available Past Due Interest:{" "}
                  {formatCurrency(selected.pastDueInterestOutstanding)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Available Penalty:{" "}
                  {formatCurrency(selected.penaltyOutstanding)}
                </Typography>
              </Box>
            )}

            <TextField
              fullWidth
              type="number"
              label="Past Due Interest Waiver"
              value={form.pastDueInterestWaiver}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  pastDueInterestWaiver: event.target.value,
                }))
              }
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              type="number"
              label="Penalty Waiver"
              value={form.penaltyWaiver}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  penaltyWaiver: event.target.value,
                }))
              }
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Reason (optional)"
              value={form.reason}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, reason: event.target.value }))
              }
            />
          </DialogContent>
          <DialogActions sx={{ p: 3, gap: 1 }}>
            <Button onClick={closeWaiverDialog} sx={{ color: "#64748b" }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={submitting}
              onClick={() => void handleApplyWaiver()}
              sx={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #059669 0%, #047857 100%)",
                },
              }}
            >
              Apply
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={historyState.open}
          onClose={closeHistoryDialog}
          maxWidth="md"
          fullWidth
          aria-labelledby="waiver-history-dialog-title"
        >
          <DialogTitle
            id="waiver-history-dialog-title"
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Typography component="span" variant="h5">
              Waiver History
            </Typography>
            <IconButton
              aria-label="Close waiver history"
              onClick={closeHistoryDialog}
              sx={{ width: 44, height: 44 }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              {historyState.target
                ? `Loan ${historyState.target.id} - ${getBorrowerName(historyState.target)}`
                : "Recent waivers"}
            </DialogContentText>
            {historyState.loading ? (
              <Typography variant="body2" color="text.secondary">
                Loading waiver history...
              </Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Created</TableCell>
                      <TableCell align="right">Past Due Interest</TableCell>
                      <TableCell align="right">Penalty</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {historyState.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                        <TableCell align="right">
                          {formatCurrency(row.pastDueInterestWaived)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(row.penaltyWaived)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(row.totalWaived)}
                        </TableCell>
                        <TableCell>{row.reason || "N/A"}</TableCell>
                      </TableRow>
                    ))}
                    {!historyState.loading &&
                      historyState.rows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography variant="body2" color="text.secondary">
                              No waiver history found for this loan.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={closeHistoryDialog} sx={{ color: "#64748b" }}>
              Close
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
