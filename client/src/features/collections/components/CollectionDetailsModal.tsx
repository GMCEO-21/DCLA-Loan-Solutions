import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Tooltip,
  Fade,
  Skeleton,
  TextField,
  InputAdornment,
  Snackbar,
  Alert,
} from "@mui/material";
import {
  Close,
  CalendarToday,
  LocationOn,
  People,
  Download,
  PictureAsPdf,
  CheckCircle,
} from "@mui/icons-material";
import { Search } from "@mui/icons-material";
import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  DailyCollectionGroup,
  Collection,
  MemberWithLoans,
} from "../types";
import collectionsService from "../api";
import { PaymentDialog } from "./PaymentDialog";
import { ReloanDialog } from "./ReloanDialog";
import { CollectionSummaryCards } from "./CollectionSummaryCards";
import { MembersTable } from "./MembersTable";
import type { Repayment } from "@features/repayments/types";
import { useAuthStore } from "@features/auth/authStore";
import {
  evaluateMemberStatus,
  getOperationalCollectionStatus,
  hasActiveLoan,
  hasLoanAmount,
  type MemberStatusResult,
} from "../utils/memberStatus";
import { withNetReleaseForDate } from "../utils/netRelease";
import { smsNotificationsApi } from "@features/notifications/api";
import SendSmsConfirmationDialog from "@features/notifications/components/SendSmsConfirmationDialog";
import { getApiErrorMessage } from "@utils/apiError";
import type { SmsEligibilityItem } from "@features/notifications/types";
import { shouldOfferRepaymentSms } from "@features/notifications/eligibility";
import { canManageSavings as roleCanManageSavings } from "@features/auth/access";
import SavingsDepositDialog from "@features/savings/components/SavingsDepositDialog";

type MemberLoan = MemberWithLoans["loans"][number] & {
  weeksPaid?: number;
  weeklyPaymentAmount?: number;
  savings?: number;
  amountPaid?: number;
  termWeeks?: number;
  paymentCountDisplayOffset?: number;
  loanCreatedDate?: string;
  createdAt?: string;
};

type MemberWithLoansExtended = Omit<MemberWithLoans, "loans"> & {
  loans: MemberLoan[];
  netCashReleasedForDate?: number;
  __computed?: {
    paymentInfo: {
      weeklyDue: number;
      shortfall: number;
      totalPaid: number;
      weeksCovered: number;
    };
    collectionMetrics: {
      received: number;
      due: number;
      weeklyDue: number;
      weeksCovered: number;
    };
    status: {
      label: MemberStatusResult["label"];
      color: MemberStatusResult["color"];
    };
  };
};

interface CollectionDetailsModalProps {
  open: boolean;
  collectionGroup?: DailyCollectionGroup;
  onClose: () => void;
  onEditCollection?: (collection: Collection) => void;
  onDataChanged?: () => void;
}

export default function CollectionDetailsModal({
  open,
  collectionGroup,
  onClose,
  onDataChanged,
}: CollectionDetailsModalProps) {
  const role = useAuthStore((state) => state.user?.role ?? "");
  const canReloan = role === "loan processor" || role === "admin";
  const canManageSavings = roleCanManageSavings(role);

  // State management
  const [members, setMembers] = useState<MemberWithLoansExtended[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supportingDataError, setSupportingDataError] = useState<string | null>(
    null,
  );
  const [exporting, setExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [latestCollections, setLatestCollections] = useState<Collection[]>(
    collectionGroup?.collections ?? [],
  );
  const [pendingPaymentMemberIds, setPendingPaymentMemberIds] = useState<
    Set<string>
  >(new Set());
  // Dialog states
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [savingsDialogOpen, setSavingsDialogOpen] = useState(false);
  const [reloanDialogOpen, setReloanDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] =
    useState<MemberWithLoansExtended | null>(null);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });
  const [smsCandidates, setSmsCandidates] = useState<SmsEligibilityItem[]>([]);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);

  const collectionByMemberId = useMemo(() => {
    const map = new Map<string, Collection>();
    const source =
      latestCollections && latestCollections.length > 0
        ? latestCollections
        : (collectionGroup?.collections ?? []);
    if (source.length) {
      source.forEach((collection) => {
        map.set(collection.memberId, collection);
      });
    }
    return map;
  }, [collectionGroup, latestCollections]);

  const shouldExportMember = useCallback(
    (member: MemberWithLoansExtended) =>
      hasActiveLoan(member) && hasLoanAmount(member),
    [],
  );

  const fetchCenterMembers = useCallback(
    async (signal?: AbortSignal) => {
      if (!collectionGroup) return;

      setLoading(true);
      setError(null);
      setSupportingDataError(null);

      try {
        const centerMembers = await collectionsService.getCenterMembers(
          collectionGroup.centerId,
          collectionGroup.collectionDate,
          signal,
        );
        let refreshedCollections: Collection[] =
          collectionGroup.collections ?? [];
        try {
          refreshedCollections =
            (await collectionsService.getCenterCollectionsByDate(
              collectionGroup.centerId,
              collectionGroup.collectionDate,
              signal,
            )) ?? refreshedCollections;
        } catch (innerErr) {
          if (signal?.aborted) throw innerErr;
          console.warn(
            "Failed to refresh center collections, using existing data:",
            innerErr,
          );
          setSupportingDataError(
            "Current collection details could not be refreshed. Existing collection data is shown.",
          );
        }
        const normalisedCollections = refreshedCollections.map((col) => ({
          ...col,
          amount: Number(col.amount ?? 0),
          paymentReceived: Number(col.paymentReceived ?? 0),
          netRelease: Number(col.netRelease ?? 0),
          numberOfPayments: Number(col.numberOfPayments ?? 0),
          advancePaymentAmount: Number(col.advancePaymentAmount ?? 0),
        }));
        setLatestCollections(normalisedCollections);

        let pendingRepayments: Repayment[] = [];
        try {
          pendingRepayments =
            await collectionsService.getPendingRepaymentsForCollection(
              collectionGroup.centerId,
              collectionGroup.collectionDate,
              signal,
            );
        } catch (innerErr) {
          if (signal?.aborted) throw innerErr;
          console.warn(
            "Failed to refresh pending repayments, using empty pending state:",
            innerErr,
          );
          setSupportingDataError((current) =>
            current
              ? `${current} Pending payment status is also unavailable.`
              : "Pending payment status is unavailable.",
          );
        }
        setPendingPaymentMemberIds(
          new Set(
            pendingRepayments
              .filter((repayment) => repayment.operationType !== "reversal")
              .map((repayment) => repayment.member?.id)
              .filter((id): id is string => Boolean(id)),
          ),
        );

        const collectionsMap = new Map(
          normalisedCollections.map((col) => [col.memberId, col]),
        );

        const membersWithCollections = centerMembers.map((member) => ({
          ...member,
          collection:
            collectionsMap.get(member.id) ??
            collectionGroup.collections?.find((c) => c.memberId === member.id),
        })) as MemberWithLoansExtended[];

        // Alphabetical sort: Last Name, First Name
        membersWithCollections.sort((a, b) => {
          const al = `${(a.lastName || "").toLowerCase()} ${(
            a.firstName || ""
          ).toLowerCase()}`.trim();
          const bl = `${(b.lastName || "").toLowerCase()} ${(
            b.firstName || ""
          ).toLowerCase()}`.trim();
          if (al < bl) return -1;
          if (al > bl) return 1;
          return 0;
        });

        const membersWithNetRelease = membersWithCollections.map((member) =>
          withNetReleaseForDate(member, collectionGroup.collectionDate),
        );

        setMembers(membersWithNetRelease);
      } catch (error) {
        if (signal?.aborted) return;
        console.error("Failed to fetch center members:", error);
        setError(getApiErrorMessage(error));
        setMembers([]);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [collectionGroup],
  );

  useEffect(() => {
    if (collectionGroup?.collections) {
      setLatestCollections(
        collectionGroup.collections.map((col) => ({
          ...col,
          amount: Number(col.amount ?? 0),
          paymentReceived: Number(col.paymentReceived ?? 0),
          netRelease: Number(col.netRelease ?? 0),
          numberOfPayments: Number(col.numberOfPayments ?? 0),
          advancePaymentAmount: Number(col.advancePaymentAmount ?? 0),
        })),
      );
    }
  }, [collectionGroup]);

  useEffect(() => {
    if (open && collectionGroup) {
      const controller = new AbortController();
      fetchCenterMembers(controller.signal);
      return () => controller.abort();
    } else if (!open) {
      // Reset state when modal closes
      setMembers([]);
      setPendingPaymentMemberIds(new Set());
      setError(null);
      setSupportingDataError(null);
      setSelectedMember(null);
      setSavingsDialogOpen(false);
    }
  }, [open, collectionGroup, fetchCenterMembers]);

  const handleOpenPaymentDialog = useCallback(
    (member: MemberWithLoansExtended) => {
      setSelectedMember(member);
      setPaymentDialogOpen(true);
    },
    [],
  );

  const handleOpenReloanDialog = useCallback(
    (member: MemberWithLoansExtended) => {
      setSelectedMember(member);
      setReloanDialogOpen(true);
    },
    [],
  );

  const handleOpenSavingsDialog = useCallback(
    (member: MemberWithLoansExtended) => {
      setSelectedMember(member);
      setSavingsDialogOpen(true);
    },
    [],
  );

  const handleClosePaymentDialog = useCallback(() => {
    setPaymentDialogOpen(false);
    setSelectedMember(null);
  }, []);

  const handleCloseReloanDialog = useCallback(() => {
    setReloanDialogOpen(false);
    setSelectedMember(null);
  }, []);

  const handleCloseSavingsDialog = useCallback(() => {
    setSavingsDialogOpen(false);
    setSelectedMember(null);
  }, []);

  const handlePaymentSuccess = useCallback(
    async (repayment: Repayment) => {
      const status = repayment?.status ?? "approved";
      await fetchCenterMembers();
      onDataChanged?.();
      setToast({
        open: true,
        message:
          status === "pending"
            ? "Payment submitted for manager approval."
            : "Payment recorded successfully.",
        severity: "success",
      });
      handleClosePaymentDialog();
      if (shouldOfferRepaymentSms(repayment)) {
        try {
          const eligibility = await smsNotificationsApi.getRepaymentEligibility(
            [repayment.id],
          );
          setSmsCandidates(eligibility);
          setSmsDialogOpen(true);
        } catch {
          setToast({
            open: true,
            message:
              "Payment recorded successfully. SMS options are temporarily unavailable.",
            severity: "success",
          });
        }
      }
    },
    [fetchCenterMembers, handleClosePaymentDialog, onDataChanged],
  );

  const handleReloanSuccess = useCallback(async () => {
    await fetchCenterMembers();
    onDataChanged?.();
    setToast({
      open: true,
      message: "Reloan processed successfully.",
      severity: "success",
    });
    handleCloseReloanDialog();
  }, [fetchCenterMembers, handleCloseReloanDialog, onDataChanged]);

  const handleSavingsSuccess = useCallback(async () => {
    await fetchCenterMembers();
    onDataChanged?.();
    setToast({
      open: true,
      message: "Savings transaction recorded successfully.",
      severity: "success",
    });
    handleCloseSavingsDialog();
  }, [fetchCenterMembers, handleCloseSavingsDialog, onDataChanged]);

  const referenceDate = useMemo(() => {
    if (!collectionGroup?.collectionDate) return null;
    return new Date(`${collectionGroup.collectionDate}T00:00:00Z`);
  }, [collectionGroup?.collectionDate]);

  const getMemberStatusInfo = useCallback(
    (member: MemberWithLoansExtended): MemberStatusResult => {
      const collection =
        collectionByMemberId.get(member.id) ||
        (member.collection as Collection | undefined);
      if (pendingPaymentMemberIds.has(member.id)) {
        const statusInfo = evaluateMemberStatus(member, {
          collection,
          referenceDate:
            referenceDate ?? collectionGroup?.collectionDate ?? undefined,
        });
        return {
          ...statusInfo,
          label: "PENDING",
          color: "warning",
        };
      }
      return evaluateMemberStatus(member, {
        collection,
        referenceDate:
          referenceDate ?? collectionGroup?.collectionDate ?? undefined,
      });
    },
    [
      collectionByMemberId,
      pendingPaymentMemberIds,
      referenceDate,
      collectionGroup?.collectionDate,
    ],
  );

  const buildExportMembers = useCallback(() => {
    if (!collectionGroup || !members.length) return [];
    // Sort alphabetically for export
    const sorted = [...members].sort((a, b) => {
      const al = `${(a.lastName || "").toLowerCase()} ${(
        a.firstName || ""
      ).toLowerCase()}`.trim();
      const bl = `${(b.lastName || "").toLowerCase()} ${(
        b.firstName || ""
      ).toLowerCase()}`.trim();
      return al.localeCompare(bl);
    });

    const eligibleMembers = sorted.filter(shouldExportMember);
    return eligibleMembers.map((member) => {
      const statusInfo = getMemberStatusInfo(member);
      const operationalStatus = getOperationalCollectionStatus(
        member,
        statusInfo,
      );
      return {
        ...member,
        __computed: {
          paymentInfo: {
            weeklyDue: statusInfo.weeklyDue,
            shortfall: statusInfo.shortfall,
            totalPaid: statusInfo.totalPaid,
            weeksCovered: statusInfo.weeksCovered,
          },
          collectionMetrics: {
            received: statusInfo.received,
            due: statusInfo.due,
            weeklyDue: statusInfo.weeklyDue,
            weeksCovered: statusInfo.weeksCovered,
          },
          status: {
            label: operationalStatus.label,
            color: operationalStatus.color,
          },
        },
      };
    });
  }, [collectionGroup, members, shouldExportMember, getMemberStatusInfo]);

  const handleExport = useCallback(async () => {
    if (!collectionGroup || !members.length) return;

    setExporting(true);
    setExportError(null);

    try {
      const exportReadyMembers = buildExportMembers();

      if (!exportReadyMembers.length) {
        throw new Error("No members available for export.");
      }

      const { exportToExcel } = await import("../utils/exportUtils");
      await exportToExcel(collectionGroup, exportReadyMembers);
    } catch (error) {
      console.error("Export failed:", error);
      setExportError(
        error instanceof Error
          ? error.message
          : "Export failed. Please try again.",
      );
    } finally {
      setExporting(false);
    }
  }, [collectionGroup, members, buildExportMembers]);

  const handleExportPdf = useCallback(async () => {
    if (!collectionGroup || !members.length) return;

    setPdfExporting(true);
    setExportError(null);

    try {
      const exportReadyMembers = buildExportMembers();
      if (!exportReadyMembers.length) {
        throw new Error("No members available for export.");
      }

      const currency = (value: number) =>
        `PHP ${Number(value || 0).toLocaleString()}`;

      const pdfRows = exportReadyMembers.map((member, index) => {
        const metrics = member.__computed?.collectionMetrics;
        const paymentInfo = member.__computed?.paymentInfo;
        const statusLabel = member.__computed?.status?.label ?? "";
        const actualPaymentsMade =
          paymentInfo?.weeksCovered ?? member.collection?.numberOfPayments ?? 0;
        const activeLoan = Array.isArray(member.loans)
          ? member.loans.find(
              (loan) => (loan?.status || "").toLowerCase() === "active",
            )
          : undefined;
        const paymentOffset = Number(
          activeLoan?.paymentCountDisplayOffset ?? 0,
        );
        const paymentsMade = Number(actualPaymentsMade || 0) + paymentOffset;
        const netReleased =
          member.netCashReleasedForDate ??
          member.netCashReleased ??
          member.collection?.netRelease ??
          0;
        return {
          no: index + 1,
          clientName: `${member.lastName || ""}, ${
            member.firstName || ""
          }`.trim(),
          contact: member.contactNumber || "",
          loanAmount: currency(Number(member.totalLoanAmount || 0)),
          overallAmount: currency(Number(member.overallAmount || 0)),
          termWeeks: String(member.totalTermWeeks || 0),
          amountDue: currency(Number(metrics?.due || 0)),
          paymentReceived: currency(Number(metrics?.received || 0)),
          netReleased: currency(Number(netReleased || 0)),
          paymentsMade: String(paymentsMade || 0),
          savings: currency(Number(member.totalSavings || 0)),
          remainingBalance: currency(Number(member.totalBalance || 0)),
          status: statusLabel,
        };
      });

      const totalAmountDueValue = exportReadyMembers.reduce((sum, member) => {
        const metrics = member.__computed?.collectionMetrics;
        return sum + Number(metrics?.due || 0);
      }, 0);

      const { exportCollectorPdf } =
        await import("../utils/exportCollectorPdf");
      await exportCollectorPdf({
        centerName: collectionGroup.centerName,
        collectionDate: collectionGroup.collectionDate,
        rows: pdfRows,
        totalAmountDue: currency(totalAmountDueValue),
      });
    } catch (error) {
      console.error("Collector PDF export failed:", error);
      setExportError(
        error instanceof Error
          ? error.message
          : "Failed to export collector report. Please try again.",
      );
    } finally {
      setPdfExporting(false);
    }
  }, [collectionGroup, members, buildExportMembers]);

  const getCollectionMetrics = useCallback(
    (member: MemberWithLoansExtended) => {
      const statusInfo = getMemberStatusInfo(member);
      return {
        received: statusInfo.received,
        due: statusInfo.due,
        weeklyDue: statusInfo.weeklyDue,
        weeksCovered: statusInfo.weeksCovered,
      };
    },
    [getMemberStatusInfo],
  );

  const getMemberPaymentInfo = useCallback(
    (member: MemberWithLoansExtended) => {
      const statusInfo = getMemberStatusInfo(member);
      return {
        weeklyDue: statusInfo.weeklyDue,
        shortfall: statusInfo.shortfall,
        totalPaid: statusInfo.totalPaid,
        weeksCovered: statusInfo.weeksCovered,
      };
    },
    [getMemberStatusInfo],
  );

  const getStatusColor = useCallback(
    (
      member: MemberWithLoansExtended,
    ): "default" | "success" | "warning" | "error" => {
      return getOperationalCollectionStatus(member, getMemberStatusInfo(member))
        .color;
    },
    [getMemberStatusInfo],
  );

  const getStatusLabel = useCallback(
    (member: MemberWithLoansExtended): string => {
      return getOperationalCollectionStatus(member, getMemberStatusInfo(member))
        .label;
    },
    [getMemberStatusInfo],
  );

  const computedStats = useMemo(() => {
    if (!collectionGroup || !members.length) {
      return null;
    }

    const eligibleMembers = members.filter(hasActiveLoan);

    const totals = eligibleMembers.reduce(
      (acc, member) => {
        acc.totalOverallAmount += Number(member.overallAmount || 0);
        acc.totalRemainingBalance += Number(member.totalBalance || 0);

        const statusInfo = getOperationalCollectionStatus(
          member,
          getMemberStatusInfo(member),
        );
        if (statusInfo.label === "PAID") {
          acc.paidCount += 1;
        } else if (statusInfo.label === "PARTIAL") {
          acc.partialCount += 1;
        } else if (statusInfo.label === "PENDING") {
          acc.pendingCount += 1;
        } else if (statusInfo.label === "UNPAID") {
          acc.unpaidCount += 1;
        }
        return acc;
      },
      {
        paidCount: 0,
        partialCount: 0,
        pendingCount: 0,
        unpaidCount: 0,
        totalOverallAmount: 0,
        totalRemainingBalance: 0,
      },
    );

    return totals;
  }, [collectionGroup, members, getMemberStatusInfo]);

  const operationalMemberCount = useMemo(
    () => members.filter(hasActiveLoan).length,
    [members],
  );

  const formatCurrency = useCallback((amount: number): string => {
    return `₱${amount.toLocaleString()}`;
  }, []);

  const totalsOverride = useMemo(() => {
    const totalAmount = latestCollections.reduce(
      (sum, collection) => sum + Number(collection.amount ?? 0),
      0,
    );
    const totalReceived = latestCollections.reduce(
      (sum, collection) => sum + Number(collection.paymentReceived ?? 0),
      0,
    );
    const pendingCollections = Math.max(
      members.length - latestCollections.length,
      0,
    );

    return {
      totalMembers: operationalMemberCount,
      totalAmount,
      totalReceived,
      pendingCollections,
    };
  }, [latestCollections, members.length, operationalMemberCount]);

  // Filtered + sorted members for table rendering
  const displayedMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    const base = members.filter(hasActiveLoan);
    const filtered = query
      ? base.filter((m) => {
          const name = `${m.firstName || ""} ${m.middleName || ""} ${
            m.lastName || ""
          }`.toLowerCase();
          const contact = (m.contactNumber || "").toLowerCase();
          return name.includes(query) || contact.includes(query);
        })
      : base;
    return filtered.sort((a, b) => {
      const al = `${(a.lastName || "").toLowerCase()} ${(
        a.firstName || ""
      ).toLowerCase()}`.trim();
      const bl = `${(b.lastName || "").toLowerCase()} ${(
        b.firstName || ""
      ).toLowerCase()}`.trim();
      return al.localeCompare(bl);
    });
  }, [members, memberSearch]);

  if (!collectionGroup) return null;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth={false}
        fullWidth
        scroll="paper"
        aria-labelledby="collection-details-title"
        PaperProps={{
          sx: {
            width: "calc(100% - 32px)",
            maxWidth: 1100,
            borderRadius: 2,
            maxHeight: "calc(100% - 32px)",
            overflow: "hidden",
          },
        }}
        TransitionComponent={Fade}
        transitionDuration={300}
      >
        <DialogTitle
          id="collection-details-title"
          sx={{
            fontWeight: 600,
            display: "flex",
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
            gap: 1,
            p: { xs: 2, sm: 2.5 },
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box sx={{ minWidth: 0, maxWidth: "100%" }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
              {collectionGroup.centerName}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Collection Details & Management
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: { xs: 1, sm: 3 },
                flexWrap: "wrap",
                color: "text.secondary",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <CalendarToday sx={{ fontSize: 16 }} />
                <Typography variant="body2">
                  {collectionGroup.collectionDay}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <LocationOn sx={{ fontSize: 16 }} />
                <Typography variant="body2">
                  {collectionGroup.collectionDate}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <People sx={{ fontSize: 16 }} />
                <Typography variant="body2">
                  {operationalMemberCount} Members
                </Typography>
              </Box>
            </Box>
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              alignSelf: "center",
              gap: 1,
              flexShrink: 0,
            }}
          >
            <Tooltip title="Export to Excel">
              <IconButton
                aria-label="Export collection details to Excel"
                onClick={handleExport}
                disabled={exporting || loading}
                sx={{
                  width: 44,
                  height: 44,
                  color: "text.secondary",
                }}
              >
                {exporting ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <Download />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title="Export collector PDF">
              <IconButton
                aria-label="Export collector PDF"
                onClick={handleExportPdf}
                disabled={pdfExporting || loading}
                sx={{
                  width: 44,
                  height: 44,
                  color: "text.secondary",
                }}
              >
                {pdfExporting ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <PictureAsPdf />
                )}
              </IconButton>
            </Tooltip>
            <IconButton
              aria-label="Close collection details"
              onClick={onClose}
              sx={{
                width: 44,
                height: 44,
                color: "text.secondary",
              }}
            >
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, overflowY: "auto" }}>
          {error && (
            <Alert
              severity="error"
              sx={{ m: 2, borderRadius: 2 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => void fetchCenterMembers()}
                >
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {supportingDataError && (
            <Alert severity="warning" sx={{ m: 2, borderRadius: 2 }}>
              {supportingDataError}
            </Alert>
          )}

          {exportError && (
            <Alert
              severity="error"
              sx={{ m: 2, borderRadius: 2 }}
              onClose={() => setExportError(null)}
            >
              {exportError}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ p: 3 }}>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                {[...Array(4)].map((_, i) => (
                  <Grid item xs={6} md={3} key={i}>
                    <Card>
                      <CardContent sx={{ textAlign: "center" }}>
                        <Skeleton
                          variant="circular"
                          width={40}
                          height={40}
                          sx={{ mx: "auto", mb: 1 }}
                        />
                        <Skeleton
                          variant="text"
                          width="60%"
                          sx={{ mx: "auto" }}
                        />
                        <Skeleton
                          variant="text"
                          width="80%"
                          sx={{ mx: "auto" }}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              <Skeleton
                variant="rectangular"
                height={400}
                sx={{ borderRadius: 2 }}
              />
            </Box>
          ) : (
            <>
              <CollectionSummaryCards
                collectionGroup={collectionGroup}
                computedStats={computedStats}
                formatCurrency={formatCurrency}
                totalsOverride={totalsOverride}
              />

              <Box sx={{ px: 3, pb: 1 }}>
                <TextField
                  fullWidth
                  placeholder="Search member by name or contact"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ color: "text.secondary" }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              <MembersTable
                members={displayedMembers}
                getStatusColor={getStatusColor}
                getStatusLabel={getStatusLabel}
                getCollectionMetrics={getCollectionMetrics}
                getPaymentInfo={getMemberPaymentInfo}
                formatCurrency={formatCurrency}
                onOpenPaymentDialog={handleOpenPaymentDialog}
                onOpenSavingsDialog={handleOpenSavingsDialog}
                onOpenReloanDialog={handleOpenReloanDialog}
                canManageSavings={canManageSavings}
                canReloan={canReloan}
              />
            </>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            p: { xs: 2, sm: 2.5 },
            backgroundColor: "background.paper",
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Button
            onClick={onClose}
            variant="outlined"
            sx={{ minHeight: 44, width: { xs: "100%", sm: "auto" } }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3500}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          severity={toast.severity}
          icon={<CheckCircle fontSize="small" />}
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>

      <PaymentDialog
        open={paymentDialogOpen}
        member={selectedMember}
        onClose={handleClosePaymentDialog}
        onSuccess={handlePaymentSuccess}
        formatCurrency={formatCurrency}
        centerId={collectionGroup.centerId}
        collectionDate={collectionGroup.collectionDate}
      />

      <ReloanDialog
        open={canReloan && reloanDialogOpen}
        member={selectedMember}
        onClose={handleCloseReloanDialog}
        onSuccess={handleReloanSuccess}
        formatCurrency={formatCurrency}
      />
      {canManageSavings && savingsDialogOpen && (
        <SavingsDepositDialog
          open
          member={selectedMember}
          onClose={handleCloseSavingsDialog}
          onSuccess={handleSavingsSuccess}
          formatCurrency={formatCurrency}
        />
      )}
      <SendSmsConfirmationDialog
        open={smsDialogOpen}
        eventType="repayment_posted"
        title="Payment Posted Successfully"
        candidates={smsCandidates}
        onClose={() => setSmsDialogOpen(false)}
      />
    </>
  );
}
