import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Alert,
  CircularProgress,
  Paper,
  Grid,
  Chip,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import {
  Close,
  Add,
  AccountBalance,
  TrendingUp,
  Savings,
  Schedule,
  History,
} from "@mui/icons-material";
import axios from "axios";
import type {
  Loan,
  LoanChargeBreakdown,
  LoanFormData,
  LoanRepaymentScheduleRow,
  MemberLoanStatusFilter,
} from "../types";
import type { Member } from "@features/member/types";
import { LoansAPI } from "../api";
import LoanForm from "./LoanForm";
import {
  calculateLoanDetails,
  formatCurrency,
} from "../utils/loanCalculations";
import { formatCollectionDate } from "../utils/date";
import { generateLoanPassbookPDF } from "@components/export/loanPassbookPDF";
import {
  transactionHistoryQueryKey,
  TransactionsAPI,
} from "@features/transactions/api";
import type {
  TransactionHistoryItem,
  TransactionHistoryResponse,
} from "@features/transactions/types";
import { smsNotificationsApi } from "@features/notifications/api";
import SendSmsConfirmationDialog from "@features/notifications/components/SendSmsConfirmationDialog";
import type { SmsEligibilityItem } from "@features/notifications/types";
import { queryClient } from "../../../queryClient";
import { formatRecordedTimestamp } from "@utils/dateTime";

interface LoanModalProps {
  open: boolean;
  member: Member;
  onClose: () => void;
  onLoanCreated?: () => void;
}

export default function LoanModal({
  open,
  member,
  onClose,
  onLoanCreated,
}: LoanModalProps) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [activeLoan, setActiveLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(false);
  const [loanListLoading, setLoanListLoading] = useState(false);
  const [creatingLoan, setCreatingLoan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loanListFilter, setLoanListFilter] =
    useState<MemberLoanStatusFilter>("all");
  const [loanListPage, setLoanListPage] = useState(1);
  const [loanListTotalPages, setLoanListTotalPages] = useState(1);
  const [loanListTotal, setLoanListTotal] = useState(0);
  const [memberLoanCount, setMemberLoanCount] = useState(0);
  const [termDialogOpen, setTermDialogOpen] = useState(false);
  const [termValue, setTermValue] = useState<4 | 8 | 12 | 24>(4);
  const [monthlyInterestRate, setMonthlyInterestRate] = useState<
    number | undefined
  >();
  const [termUpdating, setTermUpdating] = useState(false);
  const [termMessage, setTermMessage] = useState<string | null>(null);
  const [termError, setTermError] = useState<string | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyLoan, setHistoryLoan] = useState<Loan | null>(null);
  const [historySchedule, setHistorySchedule] = useState<
    LoanRepaymentScheduleRow[]
  >([]);
  const [historyTransactions, setHistoryTransactions] = useState<
    TransactionHistoryItem[]
  >([]);
  const [historyCharges, setHistoryCharges] =
    useState<LoanChargeBreakdown | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [smsCandidates, setSmsCandidates] = useState<SmsEligibilityItem[]>([]);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const loanListCacheRef = useRef(
    new Map<
      string,
      {
        items: Loan[];
        total: number;
        page: number;
        totalPages: number;
      }
    >(),
  );
  const memberLoanCountRef = useRef<number | null>(null);
  const activeLoanRef = useRef<Loan | null | undefined>(undefined);
  const historyRequestIdRef = useRef(0);

  const historyPageSize = 10;
  const loanHistoryPageSize = 2;

  const loadLoans = useCallback(async () => {
    try {
      setError(null);
      const cacheKey = `${member.id}:${loanListFilter}:${loanListPage}`;
      const cached = loanListCacheRef.current.get(cacheKey);

      if (cached) {
        setLoans(cached.items);
        setLoanListPage(cached.page);
        setLoanListTotalPages(cached.totalPages);
        setLoanListTotal(cached.total);
        if (memberLoanCountRef.current !== null) {
          setMemberLoanCount(memberLoanCountRef.current);
        }
        if (activeLoanRef.current !== undefined) {
          setActiveLoan(activeLoanRef.current);
        }
        return;
      }

      setLoanListLoading(true);

      const historyPromise = LoansAPI.getByMember(member.id, {
        status: loanListFilter,
        page: loanListPage,
        limit: loanHistoryPageSize,
      });

      const requests: Promise<unknown>[] = [historyPromise];
      let activePromise: Promise<
        Awaited<ReturnType<typeof LoansAPI.getByMember>>
      > | null = null;
      let summaryPromise: Promise<
        Awaited<ReturnType<typeof LoansAPI.getByMember>>
      > | null = null;

      if (activeLoanRef.current === undefined) {
        activePromise = LoansAPI.getByMember(member.id, {
          status: "active",
          page: 1,
          limit: 1,
        });
        requests.push(activePromise);
      }

      if (memberLoanCountRef.current === null) {
        summaryPromise = LoansAPI.getByMember(member.id, {
          status: "all",
          page: 1,
          limit: 1,
        });
        requests.push(summaryPromise);
      }

      await Promise.all(requests);

      const historyResponse = await historyPromise;
      loanListCacheRef.current.set(cacheKey, {
        items: historyResponse.items,
        total: historyResponse.total,
        page: historyResponse.page,
        totalPages: historyResponse.totalPages,
      });

      if (activePromise) {
        const activeResponse = await activePromise;
        activeLoanRef.current = activeResponse.items[0] ?? null;
        setActiveLoan(activeLoanRef.current);
      }

      if (summaryPromise) {
        const summaryResponse = await summaryPromise;
        memberLoanCountRef.current = summaryResponse.total;
        setMemberLoanCount(summaryResponse.total);
      }

      setLoans(historyResponse.items);
      setLoanListPage(historyResponse.page);
      setLoanListTotalPages(historyResponse.totalPages);
      setLoanListTotal(historyResponse.total);
    } catch (err) {
      setError("Failed to load loans");
      console.error("Error loading loans:", err);
    } finally {
      setLoanListLoading(false);
    }
  }, [loanListFilter, loanListPage, member.id]);

  // Get the active loan (should be only one)
  const hasActiveLoan = Boolean(activeLoan);
  const canEditTerm = hasActiveLoan && Number(activeLoan?.weeksPaid || 0) === 0;
  const termPreview = useMemo(() => {
    if (!activeLoan) return null;
    const calc = calculateLoanDetails(
      Number(activeLoan.principalAmount),
      termValue,
      monthlyInterestRate,
    );
    return calc.weeklyPaymentAmount;
  }, [activeLoan?.principalAmount, termValue, monthlyInterestRate]);
  const isSameTerm = activeLoan
    ? termValue === (activeLoan.termWeeks as 4 | 8 | 12 | 24) &&
      (termValue !== 24 ||
        Number(monthlyInterestRate) * 6 ===
          Number(activeLoan.interestRate) * 100)
    : true;

  // Load member's loans when modal opens
  useEffect(() => {
    if (open) {
      loadLoans();
    }
  }, [open, loadLoans]);

  useEffect(() => {
    if (open) return;
    loanListCacheRef.current.clear();
    memberLoanCountRef.current = null;
    activeLoanRef.current = undefined;
    setLoans([]);
    setActiveLoan(null);
    setLoanListFilter("all");
    setLoanListPage(1);
    setLoanListTotalPages(1);
    setLoanListTotal(0);
    setMemberLoanCount(0);
  }, [open]);

  useEffect(() => {
    if (activeLoan) {
      setTermValue(activeLoan.termWeeks as 4 | 8 | 12 | 24);
      setMonthlyInterestRate(
        activeLoan.termWeeks === 24
          ? Number(((Number(activeLoan.interestRate) * 100) / 6).toFixed(2))
          : undefined,
      );
    }
  }, [activeLoan]);

  const handleOpenTermDialog = () => {
    if (!activeLoan) return;
    setTermValue(activeLoan.termWeeks as 4 | 8 | 12 | 24);
    setMonthlyInterestRate(
      activeLoan.termWeeks === 24
        ? Number(((Number(activeLoan.interestRate) * 100) / 6).toFixed(2))
        : undefined,
    );
    setTermError(null);
    setTermDialogOpen(true);
  };

  const handleCloseTermDialog = () => {
    if (termUpdating) return;
    setTermDialogOpen(false);
    setTermError(null);
  };

  const loadLoanHistory = useCallback(async (loan: Loan, pageNumber = 1) => {
    const requestId = ++historyRequestIdRef.current;
    try {
      setHistoryLoading(true);
      setHistoryError(null);

      const transactionQuery = {
        loanId: loan.id,
        page: pageNumber,
        limit: historyPageSize,
      };

      const [schedule, transactions, charges] = await Promise.all([
        LoansAPI.getRepaymentSchedule(loan.id),
        queryClient.fetchQuery<TransactionHistoryResponse>(
          transactionHistoryQueryKey(transactionQuery),
          ({ signal }) => TransactionsAPI.getHistory(transactionQuery, signal),
          { staleTime: 45_000 },
        ),
        LoansAPI.getCharges(loan.id),
      ]);

      if (requestId !== historyRequestIdRef.current) return;
      setHistorySchedule(schedule);
      setHistoryTransactions(transactions.items);
      setHistoryCharges(charges);
      setHistoryPage(transactions.page);
      setHistoryTotalPages(transactions.totalPages);
      setHistoryTotal(transactions.total);
    } catch (err) {
      if (requestId !== historyRequestIdRef.current) return;
      setHistoryError("Failed to load loan history.");
      console.error("Error loading loan history:", err);
    } finally {
      if (requestId === historyRequestIdRef.current) {
        setHistoryLoading(false);
      }
    }
  }, []);

  const handleUpdateTerm = async () => {
    if (!activeLoan) return;
    setTermUpdating(true);
    setTermError(null);
    try {
      await LoansAPI.updateTerm(activeLoan.id, {
        termWeeks: termValue,
        ...(termValue === 24 ? { monthlyInterestRate } : {}),
      });
      setTermDialogOpen(false);
      setTermMessage("Term weeks updated successfully.");
      loanListCacheRef.current.clear();
      activeLoanRef.current = undefined;
      await loadLoans();
    } catch (err: unknown) {
      const message = axios.isAxiosError<{ message?: string | string[] }>(err)
        ? (err.response?.data?.message ??
          err.message ??
          "Unable to update term weeks.")
        : err instanceof Error
          ? err.message
          : "Unable to update term weeks.";
      setTermError(
        Array.isArray(message) ? (message[0] as string) : String(message),
      );
    } finally {
      setTermUpdating(false);
    }
  };

  const handleCloseTermMessage = () => setTermMessage(null);

  const handleOpenHistoryDialog = async (loan: Loan) => {
    setHistoryLoan(loan);
    setHistoryDialogOpen(true);
    await loadLoanHistory(loan, 1);
  };

  const handleCloseHistoryDialog = () => {
    if (historyLoading) return;
    setHistoryDialogOpen(false);
    setHistoryLoan(null);
    setHistorySchedule([]);
    setHistoryTransactions([]);
    setHistoryCharges(null);
    setHistoryError(null);
    setHistoryPage(1);
    setHistoryTotalPages(1);
    setHistoryTotal(0);
  };

  const handleHistoryPageChange = async (
    _: React.ChangeEvent<unknown>,
    pageNumber: number,
  ) => {
    if (!historyLoan || pageNumber === historyPage) return;
    await loadLoanHistory(historyLoan, pageNumber);
  };

  const handleCreateLoan = async (formData: LoanFormData) => {
    setLoading(true);
    try {
      const createdLoan = await LoansAPI.create({
        borrowerId: member.id,
        ...formData,
      });
      loanListCacheRef.current.clear();
      memberLoanCountRef.current = null;
      activeLoanRef.current = undefined;
      await loadLoans(); // Reload loans
      setCreatingLoan(false);
      onLoanCreated?.();
      try {
        const eligibility = await smsNotificationsApi.getLoanEligibility(
          createdLoan.id,
        );
        setSmsCandidates([eligibility]);
        setSmsDialogOpen(true);
      } catch {
        setSmsCandidates([
          {
            resourceId: createdLoan.id,
            memberName: `${member.firstName} ${member.lastName}`.trim(),
            amount: Number(createdLoan.principalAmount),
            recipientMasked: null,
            eligible: false,
            errorCode: "SMS_OPTIONS_UNAVAILABLE",
            errorMessage: "SMS options are temporarily unavailable.",
            notificationId: null,
            notificationStatus: null,
          },
        ]);
        setSmsDialogOpen(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setCreatingLoan(false);
      setError(null);
      onClose();
    }
  };

  const handleExportPassbook = async () => {
    if (!activeLoan) return;

    // Use loanCreatedDate if available, otherwise fall back to createdAt
    const releaseDate = activeLoan.loanCreatedDate
      ? new Date(activeLoan.loanCreatedDate)
      : new Date(activeLoan.createdAt);

    // Map activeLoan and member data to your PDF function's expected args
    const memberData = {
      firstName: member.firstName,
      lastName: member.lastName,
      middleName: member.middleName || "",
      contactNumber: member.contactNumber,
      centerLeader: member.center?.leader || "",
    };

    const loanData = {
      principalAmount: activeLoan.principalAmount,
      weeklyPaymentAmount: activeLoan.weeklyPaymentAmount,
      termWeek: activeLoan.termWeeks,
      savings: Number(activeLoan.savings || 0),
      weeksPaid: activeLoan.weeksPaid,
      createdAt: releaseDate.toISOString(), // Use loan creation date for accurate passbook
    };

    console.log("Generating PDF with:", memberData, loanData);
    console.log("Using loan creation date:", releaseDate.toLocaleDateString());

    try {
      const schedule = await LoansAPI.getRepaymentSchedule(activeLoan.id);
      // Align schedule to the member center's collection day if available (fallback only)
      const collectionDay = member.center?.collectionDay; // e.g., 'Friday'
      await generateLoanPassbookPDF(
        memberData,
        loanData,
        schedule,
        false,
        collectionDay || undefined,
      );
    } catch (err) {
      console.error("Failed to export passbook:", err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "primary";
      case "paid":
        return "success";
      case "defaulted":
        return "error";
      case "netoff":
        return "warning";
      case "payoff":
        return "info";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "paid":
        return "Paid";
      case "defaulted":
        return "Defaulted";
      case "netoff":
        return "Net Off";
      case "payoff":
        return "Pay Off";
      default:
        return status;
    }
  };

  const getScheduleStatusColor = (
    status: LoanRepaymentScheduleRow["status"],
  ): "default" | "warning" | "success" | "info" => {
    switch (status) {
      case "paid":
        return "success";
      case "partial":
        return "warning";
      case "advance":
        return "info";
      default:
        return "default";
    }
  };

  const getTransactionTypeLabel = (type: TransactionHistoryItem["type"]) => {
    switch (type) {
      case "repayment":
        return "Repayment";
      case "savings_deposit":
        return "Savings Deposit";
      case "savings_withdrawal":
        return "Savings Withdrawal";
      default:
        return type;
    }
  };

  const handleLoanFilterChange = (
    _: React.MouseEvent<HTMLElement>,
    nextFilter: MemberLoanStatusFilter | null,
  ) => {
    if (!nextFilter || nextFilter === loanListFilter) return;
    setLoanListFilter(nextFilter);
    setLoanListPage(1);
  };

  const showBlockingLoanLoader =
    loanListLoading &&
    !creatingLoan &&
    !activeLoan &&
    loans.length === 0 &&
    memberLoanCount === 0;

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="md"
        aria-labelledby="loan-management-dialog-title"
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          },
        }}
      >
        <DialogTitle
          id="loan-management-dialog-title"
          sx={{
            fontWeight: 600,
            color: "#1e293b",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pb: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <AccountBalance sx={{ color: "#3b82f6" }} />
            <Typography variant="h6" fontWeight={600}>
              {creatingLoan ? "Create Loan" : "Loan"} - {member.firstName}{" "}
              {member.lastName}
            </Typography>
          </Box>
          <IconButton
            aria-label="Close loan management"
            onClick={handleClose}
            disabled={loading}
            sx={{ width: 44, height: 44, flexShrink: 0 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {showBlockingLoanLoader ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress />
            </Box>
          ) : creatingLoan ? (
            <LoanForm
              memberId={member.id}
              memberName={`${member.firstName} ${member.lastName}`}
              onSubmit={handleCreateLoan}
              onCancel={() => setCreatingLoan(false)}
              loading={loading}
              isFirstLoan={memberLoanCount === 0}
            />
          ) : !activeLoan ? (
            // No active loan - show create loan option
            <Box>
              <Paper
                sx={{
                  p: 4,
                  textAlign: "center",
                  background:
                    "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
                  border: "2px dashed #cbd5e1",
                  mb: 4,
                }}
              >
                <AccountBalance
                  sx={{ fontSize: 64, color: "#64748b", mb: 2 }}
                />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No Active Loan
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  This member doesn't have an active loan. Create a new loan to
                  get started.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setCreatingLoan(true)}
                  sx={{
                    background:
                      "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
                    "&:hover": {
                      background:
                        "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)",
                    },
                    px: 3,
                    py: 1.5,
                    fontWeight: 600,
                  }}
                >
                  Create New Loan
                </Button>
              </Paper>
            </Box>
          ) : (
            // Show active loan
            <Box>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 3,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, color: "#1e293b" }}
                >
                  Current Loan
                </Typography>
                <Chip
                  label={getStatusLabel(activeLoan!.status)}
                  color={getStatusColor(activeLoan!.status)}
                  size="small"
                />
              </Box>

              <Paper
                sx={{
                  p: 3,
                  background:
                    "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                  border: "1px solid #e2e8f0",
                  "&:hover": {
                    borderColor: "#3b82f6",
                    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.1)",
                  },
                }}
              >
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 600, color: "#1e293b" }}
                  >
                    Loan #{activeLoan!.id.slice(0, 8)}...
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Loan Created:{" "}
                    {activeLoan.loanCreatedDate
                      ? new Date(
                          activeLoan.loanCreatedDate,
                        ).toLocaleDateString()
                      : new Date(activeLoan!.createdAt).toLocaleDateString()}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: "0.75rem" }}
                  >
                    Record Created:{" "}
                    {new Date(activeLoan!.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={4}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <TrendingUp sx={{ fontSize: 16, color: "#64748b" }} />
                      <Typography variant="body2" color="text.secondary">
                        Principal
                      </Typography>
                    </Box>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 600, color: "#1e293b" }}
                    >
                      {formatCurrency(activeLoan!.principalAmount)}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6} md={4}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <AccountBalance sx={{ fontSize: 16, color: "#64748b" }} />
                      <Typography variant="body2" color="text.secondary">
                        Total Amount
                      </Typography>
                    </Box>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 600, color: "#1e293b" }}
                    >
                      {formatCurrency(activeLoan!.totalAmount)}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6} md={4}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <Schedule sx={{ fontSize: 16, color: "#64748b" }} />
                      <Typography variant="body2" color="text.secondary">
                        Weekly Payment
                      </Typography>
                    </Box>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 600, color: "#1e293b" }}
                    >
                      {formatCurrency(activeLoan!.weeklyPaymentAmount)}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6} md={4}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <Schedule sx={{ fontSize: 16, color: "#64748b" }} />
                      <Typography variant="body2" color="text.secondary">
                        Progress
                      </Typography>
                    </Box>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 600, color: "#1e293b" }}
                    >
                      {activeLoan!.weeksPaid}/{activeLoan!.termWeeks} weeks
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6} md={4}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <Savings sx={{ fontSize: 16, color: "#64748b" }} />
                      <Typography variant="body2" color="text.secondary">
                        Savings
                      </Typography>
                    </Box>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 600, color: "#1e293b" }}
                    >
                      {formatCurrency(Number(activeLoan!.savings || 0))}
                    </Typography>
                  </Grid>

                  {typeof activeLoan.netCashReleased !== "undefined" && (
                    <Grid item xs={12} sm={6} md={4}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          mb: 1,
                        }}
                      >
                        <Savings sx={{ fontSize: 16, color: "#64748b" }} />
                        <Typography variant="body2" color="text.secondary">
                          Net Cash Released
                        </Typography>
                      </Box>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        {formatCurrency(activeLoan.netCashReleased || 0)}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Box>
          )}

          {/* Show loan history if there are any loans (active or past) */}
          {memberLoanCount > 0 && (
            <Box sx={{ mt: 4 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 2,
                  mb: 2,
                  flexWrap: "wrap",
                }}
              >
                <Box>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 600, color: "#1e293b" }}
                  >
                    Loan History
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {loanListTotal} result{loanListTotal === 1 ? "" : "s"} for{" "}
                    {loanListFilter}
                  </Typography>
                </Box>
                <ToggleButtonGroup
                  size="small"
                  color="primary"
                  exclusive
                  value={loanListFilter}
                  onChange={handleLoanFilterChange}
                >
                  <ToggleButton value="all" disabled={loanListLoading}>
                    All
                  </ToggleButton>
                  <ToggleButton value="active" disabled={loanListLoading}>
                    Active
                  </ToggleButton>
                  <ToggleButton value="paid" disabled={loanListLoading}>
                    Paid
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
              {loanListLoading && (
                <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              <Grid container spacing={2}>
                {loans.map((loan) => (
                  <Grid item xs={12} key={loan.id}>
                    <Paper
                      onClick={() => void handleOpenHistoryDialog(loan)}
                      sx={{
                        p: 2,
                        cursor: "pointer",
                        background:
                          loan.status === "active"
                            ? "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)"
                            : "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
                        border:
                          loan.status === "active"
                            ? "1px solid #3b82f6"
                            : "1px solid #cbd5e1",
                        transition:
                          "transform 0.15s ease, box-shadow 0.15s ease",
                        "&:hover": {
                          transform: "translateY(-1px)",
                          boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
                        },
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Box>
                          <Typography
                            variant="body1"
                            sx={{ fontWeight: 600, color: "#1e293b" }}
                          >
                            Loan #{loan.id.slice(0, 8)}... -{" "}
                            {getStatusLabel(loan.status)}
                            {loan.status === "active" && (
                              <Chip
                                label="CURRENT"
                                size="small"
                                sx={{
                                  ml: 1,
                                  backgroundColor: "#3b82f6",
                                  color: "white",
                                  fontSize: "0.7rem",
                                  height: 20,
                                }}
                              />
                            )}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {formatCurrency(loan.principalAmount)} •{" "}
                            {loan.termWeeks} weeks •
                            {loan.loanCreatedDate
                              ? new Date(
                                  loan.loanCreatedDate,
                                ).toLocaleDateString()
                              : new Date(loan.createdAt).toLocaleDateString()}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="primary.main"
                            sx={{ fontWeight: 600 }}
                          >
                            Click to view repayment history
                          </Typography>
                        </Box>
                        <Chip
                          label={getStatusLabel(loan.status)}
                          color={getStatusColor(loan.status)}
                          size="small"
                        />
                      </Box>
                    </Paper>
                  </Grid>
                ))}
                {!loanListLoading && loans.length === 0 && (
                  <Grid item xs={12}>
                    <Paper
                      sx={{
                        p: 3,
                        textAlign: "center",
                        border: "1px solid #e2e8f0",
                        background:
                          "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        No{" "}
                        {loanListFilter === "all" ? "" : loanListFilter + " "}
                        loans found on this page.
                      </Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
              {loanListTotalPages > 1 && (
                <Box
                  sx={{ display: "flex", justifyContent: "center", mt: 2.5 }}
                >
                  <Pagination
                    count={loanListTotalPages}
                    page={loanListPage}
                    color="primary"
                    onChange={(_, pageNumber) => setLoanListPage(pageNumber)}
                  />
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        {!creatingLoan && hasActiveLoan && (
          <DialogActions
            sx={{
              gap: 1,
              flexDirection: { xs: "column-reverse", sm: "row" },
              alignItems: { xs: "stretch", sm: "center" },
              "& > .MuiButton-root": {
                minHeight: 44,
                width: { xs: "100%", sm: "auto" },
                m: 0,
              },
            }}
          >
            <Button onClick={handleClose} sx={{ color: "#64748b" }}>
              Close
            </Button>
            {canEditTerm && (
              <Button
                variant="outlined"
                onClick={handleOpenTermDialog}
                sx={{
                  borderColor: "#3b82f6",
                  color: "#3b82f6",
                  "&:hover": {
                    borderColor: "#2563eb",
                    backgroundColor: "#dbeafe",
                  },
                }}
              >
                Adjust Term
              </Button>
            )}
            <Button variant="contained" onClick={handleExportPassbook}>
              Download Passbook
            </Button>
          </DialogActions>
        )}
      </Dialog>
      <Dialog
        open={historyDialogOpen}
        onClose={handleCloseHistoryDialog}
        fullWidth
        maxWidth="md"
        aria-labelledby="loan-history-dialog-title"
      >
        <DialogTitle
          id="loan-history-dialog-title"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <History color="primary" />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {historyLoan
                  ? `Loan History - ${historyLoan.id.slice(0, 8)}...`
                  : "Loan History"}
              </Typography>
              {historyLoan && (
                <Typography variant="body2" color="text.secondary">
                  {member.firstName} {member.lastName} |{" "}
                  {getStatusLabel(historyLoan.status)}
                </Typography>
              )}
            </Box>
          </Box>
          <IconButton
            aria-label="Close loan history"
            onClick={handleCloseHistoryDialog}
            disabled={historyLoading}
            sx={{ width: 44, height: 44 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {historyError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {historyError}
            </Alert>
          )}

          {historyLoan && (
            <Paper
              sx={{
                p: 2.5,
                mb: 3,
                borderRadius: 2,
                border: "1px solid #e2e8f0",
                background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
              }}
            >
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Principal
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {formatCurrency(historyLoan.principalAmount)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Weekly Payment
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {formatCurrency(historyLoan.weeklyPaymentAmount)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Amount Paid
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {formatCurrency(historyLoan.amountPaid)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Remaining Balance
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {formatCurrency(historyLoan.balance)}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          )}

          {historyCharges && (
            <Paper
              sx={{
                p: 2.5,
                mb: 3,
                borderRadius: 2,
                border: "1px solid #e2e8f0",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 2,
                  mb: 2,
                }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Penalties and Past-Due Interest
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Append-only charge history and current settlement totals.
                  </Typography>
                </Box>
                <Chip
                  color={historyCharges.eligible ? "primary" : "default"}
                  label={
                    historyCharges.eligible
                      ? `${historyCharges.policyVersion} · Effective ${historyCharges.policyEffectiveDate}`
                      : "Legacy / Not Applicable"
                  }
                />
              </Box>

              {historyCharges.eligible && (
                <>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    {[
                      ["Penalty accrued", historyCharges.penaltyAccrued],
                      ["Penalty paid", historyCharges.penaltyPaid],
                      ["Penalty waived", historyCharges.penaltyWaived],
                      [
                        "Penalty outstanding",
                        historyCharges.penaltyOutstanding,
                      ],
                      ["PDI accrued", historyCharges.pastDueInterestAccrued],
                      ["PDI paid", historyCharges.pastDueInterestPaid],
                      ["PDI waived", historyCharges.pastDueInterestWaived],
                      [
                        "PDI outstanding",
                        historyCharges.pastDueInterestOutstanding,
                      ],
                    ].map(([label, value]) => (
                      <Grid item xs={6} sm={3} key={String(label)}>
                        <Typography variant="caption" color="text.secondary">
                          {label}
                        </Typography>
                        <Typography sx={{ fontWeight: 700 }}>
                          {formatCurrency(Number(value))}
                        </Typography>
                      </Grid>
                    ))}
                  </Grid>
                  <Alert
                    severity={
                      historyCharges.reconciliation?.reconciled
                        ? "success"
                        : "warning"
                    }
                    sx={{ mb: 2 }}
                  >
                    Ledger reconciliation:{" "}
                    {historyCharges.reconciliation?.reconciled
                      ? "Matched"
                      : "Needs investigation"}
                  </Alert>
                  <TableContainer sx={{ maxHeight: 280 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Recorded</TableCell>
                          <TableCell>Charge</TableCell>
                          <TableCell>Event</TableCell>
                          <TableCell>Period</TableCell>
                          <TableCell align="right">Base</TableCell>
                          <TableCell align="right">Rate</TableCell>
                          <TableCell align="right">Amount</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {historyCharges.entries.map((entry) => (
                          <TableRow key={entry.id} hover>
                            <TableCell>
                              {formatRecordedTimestamp(entry.createdAt)}
                            </TableCell>
                            <TableCell>
                              {entry.chargeType.replaceAll("_", " ")}
                            </TableCell>
                            <TableCell>
                              {entry.eventType.replaceAll("_", " ")}
                            </TableCell>
                            <TableCell>
                              {entry.periodStart ?? "—"}
                              {entry.periodEnd &&
                              entry.periodEnd !== entry.periodStart
                                ? ` to ${entry.periodEnd}`
                                : ""}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(Number(entry.baseAmount))}
                            </TableCell>
                            <TableCell align="right">
                              {(Number(entry.rate) * 100).toFixed(2)}%
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(Number(entry.amount))}
                            </TableCell>
                          </TableRow>
                        ))}
                        {historyCharges.entries.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} align="center">
                              No charge events recorded.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </Paper>
          )}

          {historyLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              <Grid item xs={12} md={7}>
                <Paper sx={{ borderRadius: 2, border: "1px solid #e2e8f0" }}>
                  <Box sx={{ p: 2.5 }}>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 700, color: "#1e293b" }}
                    >
                      Repayment Schedule
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Fixed schedule for this loan only.
                    </Typography>
                  </Box>
                  <Divider />
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Week</TableCell>
                          <TableCell>Due Date</TableCell>
                          <TableCell align="right">Due</TableCell>
                          <TableCell align="right">Paid</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {historySchedule.map((row) => (
                          <TableRow key={row.id} hover>
                            <TableCell>{row.weekNumber}</TableCell>
                            <TableCell>
                              {new Date(row.dueDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(row.amountDue)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(row.amountPaid)}
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={row.status.toUpperCase()}
                                color={getScheduleStatusColor(row.status)}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                        {historySchedule.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} align="center">
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                No repayment schedule found for this loan.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>

              <Grid item xs={12} md={5}>
                <Paper sx={{ borderRadius: 2, border: "1px solid #e2e8f0" }}>
                  <Box sx={{ p: 2.5 }}>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 700, color: "#1e293b" }}
                    >
                      Loan Transactions
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Queried by `loanId` and paged {historyPageSize} at a time.
                    </Typography>
                  </Box>
                  <Divider />
                  <Box sx={{ p: 2.5 }}>
                    {historyTransactions.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No transactions found for this loan.
                      </Typography>
                    ) : (
                      <Box sx={{ display: "grid", gap: 1.5 }}>
                        {historyTransactions.map((transaction) => (
                          <Paper
                            key={transaction.id}
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              backgroundColor: "#fff",
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 2,
                              }}
                            >
                              <Box>
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 700 }}
                                >
                                  {getTransactionTypeLabel(transaction.type)}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Recorded:{" "}
                                  {formatRecordedTimestamp(
                                    transaction.createdAt,
                                  )}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                >
                                  Collection date:{" "}
                                  {formatCollectionDate(
                                    transaction.collectionDate,
                                  )}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {transaction.notes || "No notes"}
                                </Typography>
                              </Box>
                              <Box sx={{ textAlign: "right" }}>
                                <Chip
                                  size="small"
                                  color={
                                    transaction.direction === "credit"
                                      ? "success"
                                      : "error"
                                  }
                                  label={transaction.direction.toUpperCase()}
                                  sx={{ mb: 1 }}
                                />
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 700 }}
                                >
                                  {formatCurrency(transaction.amount)}
                                </Typography>
                              </Box>
                            </Box>
                          </Paper>
                        ))}
                      </Box>
                    )}

                    {historyTotalPages > 1 && (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          mt: 2,
                          gap: 2,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {historyTotal} transaction
                          {historyTotal === 1 ? "" : "s"}
                        </Typography>
                        <Pagination
                          count={historyTotalPages}
                          page={historyPage}
                          size="small"
                          color="primary"
                          onChange={handleHistoryPageChange}
                        />
                      </Box>
                    )}
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseHistoryDialog}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={termDialogOpen}
        onClose={handleCloseTermDialog}
        maxWidth="xs"
        fullWidth
        aria-labelledby="adjust-term-dialog-title"
      >
        <DialogTitle
          id="adjust-term-dialog-title"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography component="span" variant="h6">
            Adjust Term Weeks
          </Typography>
          <IconButton
            aria-label="Close adjust term dialog"
            onClick={handleCloseTermDialog}
            sx={{ width: 44, height: 44 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This action is only available before the first repayment is
            recorded.
          </Typography>
          {termError && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              onClose={() => setTermError(null)}
            >
              {termError}
            </Alert>
          )}
          <ToggleButtonGroup
            color="primary"
            value={termValue}
            exclusive
            onChange={(_, value) => {
              if (!value) return;
              setTermValue(value);
              if (value !== 24) setMonthlyInterestRate(undefined);
            }}
            sx={{ mb: 2, display: "flex", justifyContent: "center" }}
          >
            {[4, 8, 12, 24].map((term) => (
              <ToggleButton key={term} value={term}>
                {term} Weeks
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {termValue === 24 && (
            <TextField
              fullWidth
              required
              label="Monthly Interest Rate (%)"
              type="number"
              value={monthlyInterestRate ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setMonthlyInterestRate(
                  value === "" ? undefined : Number(value),
                );
              }}
              inputProps={{ min: 3.33, max: 10, step: 0.01 }}
              helperText="Enter 3.33% to 10% per month"
              sx={{ mb: 2 }}
            />
          )}
          {termPreview !== null && (
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                Weekly Payment Preview
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {formatCurrency(termPreview)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTermDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpdateTerm}
            disabled={
              termUpdating ||
              isSameTerm ||
              (termValue === 24 &&
                (!monthlyInterestRate ||
                  monthlyInterestRate < 3.33 ||
                  monthlyInterestRate > 10))
            }
          >
            {termUpdating ? "Updating..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={Boolean(termMessage)}
        autoHideDuration={3000}
        onClose={handleCloseTermMessage}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseTermMessage}
          severity="success"
          sx={{ width: "100%" }}
        >
          {termMessage}
        </Alert>
      </Snackbar>
      <SendSmsConfirmationDialog
        open={smsDialogOpen}
        eventType="loan_created"
        title="Loan Created Successfully"
        candidates={smsCandidates}
        onClose={() => setSmsDialogOpen(false)}
      />
    </>
  );
}
