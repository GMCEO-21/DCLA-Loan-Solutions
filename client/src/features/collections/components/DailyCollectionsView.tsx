import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Alert,
  CircularProgress,
  Skeleton,
} from "@mui/material";
import {
  CalendarToday,
  LocationOn,
  People,
  CheckCircle,
  Schedule,
  Warning,
  HourglassEmpty,
  Visibility,
  FileDownload,
} from "@mui/icons-material";
import { useCallback, useEffect, useMemo, useState } from "react";
import CollectionStatsCard from "./CollectionStatsCard";
import collectionsService from "../api";
import type {
  DailyCollectionGroup,
  MemberWithLoans,
  Collection,
} from "../types";
import {
  evaluateMemberStatus,
  getOperationalCollectionStatus,
  hasActiveLoan,
  hasLoanAmount,
} from "../utils/memberStatus";
import { withNetReleaseForDate } from "../utils/netRelease";
import {
  formatCollectionDatasetDate,
  getCollectionWeekRange,
} from "../utils/date";
import {
  combineWeeklyFinancialSummaries,
  getWeeklyFinancialSummary,
} from "../utils/weeklySummary";
import type { WeeklyFinancialSummary } from "../utils/weeklySummary";

interface DailyCollectionsViewProps {
  data: DailyCollectionGroup[];
  onViewDetails: (group: DailyCollectionGroup) => void;
  loading?: boolean;
  datasetDate: string;
  isDaily?: boolean;
}

type MemberWithLoansExtended = MemberWithLoans & {
  netCashReleasedForDate?: number;
};

const getGroupKey = (group: DailyCollectionGroup) =>
  `${group.centerId}::${group.collectionDate}`;

function LoanConditionSummary({
  members,
}: {
  members: MemberWithLoansExtended[];
}) {
  const counts = members.filter(hasActiveLoan).reduce(
    (result, member) => {
      if (member.loanCondition?.status === "past_due") {
        result.pastDue += 1;
      } else if (member.loanCondition?.status === "past_maturity") {
        result.pastMaturity += 1;
      }
      return result;
    },
    { pastDue: 0, pastMaturity: 0 },
  );
  const labels = [
    counts.pastDue > 0 ? `${counts.pastDue} Past Due` : null,
    counts.pastMaturity > 0 ? `${counts.pastMaturity} Past Maturity` : null,
  ].filter((label): label is string => label !== null);

  if (labels.length === 0) return null;

  return (
    <Typography
      variant="caption"
      color="text.secondary"
      display="block"
      sx={{ mt: 1 }}
    >
      {labels.join(" · ")}
    </Typography>
  );
}

function WeeklyFinancialNotes({
  summary,
}: {
  summary: WeeklyFinancialSummary | null;
}) {
  if (!summary || summary.incompleteScheduleLoanCount === 0) return null;

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" color="warning.main" display="block">
        {summary.incompleteScheduleLoanCount === 1
          ? "1 Weekly Schedule Issue"
          : `${summary.incompleteScheduleLoanCount} Weekly Schedule Issues`}
      </Typography>
    </Box>
  );
}

export default function DailyCollectionsView({
  data,
  onViewDetails,
  loading,
  datasetDate,
  isDaily = false,
}: DailyCollectionsViewProps) {
  const [exportingAll, setExportingAll] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [supportingDataError, setSupportingDataError] = useState<string | null>(
    null,
  );
  const [centerMembersMap, setCenterMembersMap] = useState<
    Record<string, MemberWithLoansExtended[]>
  >({});
  const [pendingPaymentMemberIdsMap, setPendingPaymentMemberIdsMap] = useState<
    Record<string, string[]>
  >({});
  const [membersLoading, setMembersLoading] = useState(false);

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString()}`;
  };

  const formattedDatasetDate = formatCollectionDatasetDate(datasetDate);
  const { weekStart, weekEnd } = getCollectionWeekRange(datasetDate);
  const formatWeeklyCurrency = (
    summary: WeeklyFinancialSummary | null,
    amount: number | undefined,
  ) => {
    if (!summary) return "—";
    if (!summary.available) return "Not available";
    return amount === undefined ? "Not available" : formatCurrency(amount);
  };

  // Fetch members for each center so cards use the same basis as the modal
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const fetchAll = async () => {
      if (!cancelled) {
        setMembersLoading(true);
        setCenterMembersMap({});
        setPendingPaymentMemberIdsMap({});
        setSupportingDataError(null);
      }
      try {
        const results = await Promise.all(
          data.map(async (group) => {
            try {
              const members = await collectionsService.getCenterMembers(
                group.centerId,
                group.collectionDate,
                controller.signal,
              );
              // Attach today's collection to each member for convenience
              const withCollections = members.map((m) =>
                withNetReleaseForDate(
                  {
                    ...m,
                    collection: group.collections.find(
                      (c) => c.memberId === m.id,
                    ),
                  } as MemberWithLoans,
                  group.collectionDate,
                ),
              );
              const pendingRepayments =
                await collectionsService.getPendingRepaymentsForCollection(
                  group.centerId,
                  group.collectionDate,
                  controller.signal,
                );
              return {
                centerId: group.centerId,
                groupKey: getGroupKey(group),
                members: withCollections as MemberWithLoansExtended[],
                pendingMemberIds: pendingRepayments
                  .filter((repayment) => repayment.operationType !== "reversal")
                  .map((repayment) => repayment.member?.id)
                  .filter((id): id is string => Boolean(id)),
                failed: false,
              };
            } catch {
              return {
                centerId: group.centerId,
                groupKey: getGroupKey(group),
                members: [] as MemberWithLoansExtended[],
                pendingMemberIds: [] as string[],
                failed: true,
              };
            }
          }),
        );
        if (!cancelled) {
          const map: Record<string, MemberWithLoansExtended[]> = {};
          const pendingMap: Record<string, string[]> = {};
          results.forEach((r) => (map[r.centerId] = r.members));
          results.forEach((r) => (pendingMap[r.groupKey] = r.pendingMemberIds));
          setCenterMembersMap(map);
          setPendingPaymentMemberIdsMap(pendingMap);
          if (results.some((result) => result.failed)) {
            setSupportingDataError(
              results.every((result) => result.failed)
                ? "Member and pending payment details are temporarily unavailable."
                : "Some member or pending payment details are temporarily unavailable.",
            );
          }
        }
      } catch {
        if (!cancelled) {
          setCenterMembersMap({});
          setPendingPaymentMemberIdsMap({});
          setSupportingDataError(
            "Member and pending payment details are temporarily unavailable.",
          );
        }
      } finally {
        if (!cancelled) {
          setMembersLoading(false);
        }
      }
    };
    if (data.length > 0) {
      fetchAll();
    } else {
      setCenterMembersMap({});
      setPendingPaymentMemberIdsMap({});
      setSupportingDataError(null);
      setMembersLoading(false);
    }
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [data]);

  const getMembersFor = useCallback(
    (centerId: string) => centerMembersMap[centerId] || [],
    [centerMembersMap],
  );

  const getGroupWeeklySummary = useCallback(
    (group: DailyCollectionGroup) => {
      const members = centerMembersMap[group.centerId];
      if (!members || (members.length === 0 && group.totalMembers > 0)) {
        return null;
      }
      return getWeeklyFinancialSummary(members);
    },
    [centerMembersMap],
  );

  const getStatusCounts = useCallback(
    (group: DailyCollectionGroup) => {
      const members = getMembersFor(group.centerId);
      if (members.length === 0) {
        return { paid: 0, partial: 0, pending: 0, unpaid: 0 };
      }
      const pendingMemberIds = new Set(
        pendingPaymentMemberIdsMap[getGroupKey(group)] ?? [],
      );
      const collectionMap = new Map(
        group.collections.map((collection) => [
          collection.memberId,
          collection,
        ]),
      );
      return members.reduce(
        (acc, member) => {
          if (!hasActiveLoan(member)) return acc;
          if (pendingMemberIds.has(member.id)) {
            acc.pending += 1;
            return acc;
          }
          const collection = (collectionMap.get(member.id) ||
            null) as Collection | null;
          const status = getOperationalCollectionStatus(
            member,
            evaluateMemberStatus(member, {
              collection,
              referenceDate: group.collectionDate,
            }),
          );
          if (status.label === "PAID") {
            acc.paid += 1;
          } else if (status.label === "PARTIAL") {
            acc.partial += 1;
          } else {
            acc.unpaid += 1;
          }
          return acc;
        },
        { paid: 0, partial: 0, pending: 0, unpaid: 0 },
      );
    },
    [getMembersFor, pendingPaymentMemberIdsMap],
  );

  const getPaidCount = (group: DailyCollectionGroup) =>
    getStatusCounts(group).paid;
  const getPartialCount = (group: DailyCollectionGroup) =>
    getStatusCounts(group).partial;
  const getPendingCount = (group: DailyCollectionGroup) =>
    getStatusCounts(group).pending;
  const getUnpaidCount = (group: DailyCollectionGroup) =>
    getStatusCounts(group).unpaid;
  const getOperationalMemberCount = (group: DailyCollectionGroup) => {
    const counts = getStatusCounts(group);
    return counts.paid + counts.partial + counts.pending + counts.unpaid;
  };

  // End-of-Day totals across all groups (for the selected date)
  const eod = (() => {
    const totalReceived = data.reduce(
      (sum, group) => sum + (Number(group.totalReceived) || 0),
      0,
    );
    const totalReleased = data.reduce((sum, g) => {
      const members = getMembersFor(g.centerId);
      return (
        sum +
        members.reduce(
          (s, m) =>
            s + Number(m.netCashReleasedForDate ?? m.netCashReleased ?? 0),
          0,
        )
      );
    }, 0);
    return { totalReceived, totalReleased };
  })();

  const pageWeeklySummary = combineWeeklyFinancialSummaries(
    data.map(getGroupWeeklySummary),
  );

  const handleExportAllCollections = async () => {
    if (data.length === 0) return;

    setExportingAll(true);
    setExportError(null);

    try {
      // Fetch member details for all centers
      const exportBundles = await Promise.all(
        data.map(async (group) => {
          try {
            const centerMembers = await collectionsService.getCenterMembers(
              group.centerId,
              group.collectionDate,
            );

            // Map the data to include collection information
            const membersWithCollections = centerMembers.map((member) =>
              withNetReleaseForDate(
                {
                  ...member,
                  collection: group.collections.find(
                    (c) => c.memberId === member.id,
                  ),
                  numberOfPayments:
                    member.numberOfPayments ||
                    member.collection?.numberOfPayments ||
                    0,
                } as MemberWithLoans,
                group.collectionDate,
              ),
            );

            const typedMembers =
              membersWithCollections as MemberWithLoansExtended[];
            const pendingMemberIds = new Set(
              pendingPaymentMemberIdsMap[getGroupKey(group)] ?? [],
            );
            const exportableMembers = typedMembers
              .filter(
                (member) => hasActiveLoan(member) && hasLoanAmount(member),
              )
              .map((member) => {
                const current = evaluateMemberStatus(member, {
                  collection: member.collection,
                  referenceDate: group.collectionDate,
                });
                const status = pendingMemberIds.has(member.id)
                  ? {
                      ...current,
                      label: "PENDING" as const,
                      color: "warning" as const,
                    }
                  : getOperationalCollectionStatus(member, current);
                return {
                  ...member,
                  __computed: {
                    status: { label: status.label, color: status.color },
                  },
                };
              });

            return {
              group,
              members: exportableMembers,
            };
          } catch (error) {
            console.error(
              `Failed to fetch members for center ${group.centerName}:`,
              error,
            );
            // Return with empty members array to avoid breaking the export
            return {
              group,
              members: [] as MemberWithLoansExtended[],
            };
          }
        }),
      );

      // Filter out bundles with no members (failed API calls)
      const validBundles = exportBundles.filter(
        (bundle) => bundle.members.length > 0,
      );

      if (validBundles.length === 0) {
        throw new Error("No data available to export. Please try again.");
      }

      // Generate the multi-sheet Excel file
      const fileName = isDaily
        ? "Daily_Collections_Report"
        : "Collections_By_Date_Report";

      const { exportAllCollectionsToExcel } = await import(
        "../utils/exportUtils"
      );
      await exportAllCollectionsToExcel(
        validBundles,
        fileName,
        isDaily ? "daily" : "by-date",
      );

      // Show success feedback
      console.log(
        `Successfully exported ${validBundles.length} collection reports`,
      );
    } catch (error) {
      console.error("Failed to export all collections:", error);
      setExportError(
        error instanceof Error
          ? error.message
          : "Failed to export collections. Please try again.",
      );
    } finally {
      setExportingAll(false);
    }
  };

  const displayedData = useMemo(() => {
    return [...data].sort((a, b) =>
      (a.centerName || "").localeCompare(b.centerName || ""),
    );
  }, [data]);

  if (data.length === 0) {
    return (
      <Box
        sx={{
          textAlign: "center",
          py: { xs: 5, sm: 6 },
          px: 2,
        }}
      >
        <Schedule sx={{ fontSize: 40, color: "text.disabled", mb: 1.5 }} />
        <Typography variant="h6" gutterBottom>
          {isDaily
            ? "No scheduled centers for this date"
            : "No centers found for this date"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {isDaily
            ? "No collections are scheduled for this date."
            : "No collection groups are available for this date."}
        </Typography>
      </Box>
    );
  }

  if (membersLoading && Object.keys(centerMembersMap).length === 0) {
    return (
      <Box>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
            pb: 3,
            borderBottom: "1px solid",
            borderColor: "divider",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Box sx={{ flex: 1, minWidth: { xs: 0, sm: 280 } }}>
            <Skeleton variant="text" width="40%" height={36} />
            <Skeleton variant="text" width="30%" height={24} />
            <Skeleton
              variant="rounded"
              width={320}
              height={40}
              sx={{ mt: 2 }}
            />
            <Box sx={{ display: "flex", gap: 2, mt: 2, flexWrap: "wrap" }}>
              <Skeleton variant="rounded" width={130} height={56} />
              <Skeleton variant="rounded" width={130} height={56} />
              <Skeleton variant="rounded" width={130} height={56} />
            </Box>
          </Box>
          <Skeleton variant="rounded" width={190} height={44} />
        </Box>

        {Array.from({ length: Math.min(Math.max(data.length, 1), 3) }).map(
          (_, index) => (
            <Card
              key={index}
              elevation={0}
              sx={{
                mb: 2,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  p: 3,
                  backgroundColor: "action.hover",
                }}
              >
                <Grid container spacing={2}>
                  <Grid item xs={12} md={8}>
                    <Skeleton variant="text" width="40%" height={36} />
                    <Skeleton variant="text" width="32%" height={24} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box
                      sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                    >
                      <Skeleton variant="text" width="70%" height={36} />
                      <Skeleton variant="text" width="55%" height={24} />
                      <Skeleton variant="text" width="55%" height={24} />
                    </Box>
                  </Grid>
                </Grid>
              </Box>
              <CardContent sx={{ p: 3 }}>
                <Grid container spacing={3} sx={{ mb: 3 }}>
                  {Array.from({ length: 4 }).map((__, statIndex) => (
                    <Grid item xs={6} md={3} key={statIndex}>
                      <Skeleton variant="rounded" height={88} />
                    </Grid>
                  ))}
                </Grid>
                <Box sx={{ textAlign: "right" }}>
                  <Skeleton
                    variant="rounded"
                    width={140}
                    height={42}
                    sx={{ ml: "auto" }}
                  />
                </Box>
              </CardContent>
            </Card>
          ),
        )}
      </Box>
    );
  }

  return (
    <Box>
      {/* Current collection results header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "stretch", md: "flex-start" },
          flexDirection: { xs: "column", md: "row" },
          gap: 2,
          mb: 3,
          pb: 3,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
            {isDaily
              ? `Collection Summary for ${formattedDatasetDate}`
              : `Collection Week: ${formatCollectionDatasetDate(weekStart)} – ${formatCollectionDatasetDate(weekEnd)}`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isDaily
              ? `${data.length} scheduled center${data.length !== 1 ? "s" : ""} shown`
              : `${data.length} center${data.length !== 1 ? "s" : ""} shown`}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(3, minmax(0, 1fr))",
              },
              gap: 1.5,
              mt: 2,
              maxWidth: 680,
            }}
          >
            <Box
              sx={{
                p: 1.5,
                backgroundColor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {isDaily ? "Collected Today" : "Weekly Due"}
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {isDaily
                  ? formatCurrency(eod.totalReceived)
                  : formatWeeklyCurrency(
                      pageWeeklySummary,
                      pageWeeklySummary?.due,
                    )}
              </Typography>
            </Box>
            <Box
              sx={{
                p: 1.5,
                backgroundColor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {isDaily ? "Weekly Remaining" : "Applied to Week"}
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {isDaily
                  ? formatWeeklyCurrency(
                      pageWeeklySummary,
                      pageWeeklySummary?.remaining,
                    )
                  : formatWeeklyCurrency(
                      pageWeeklySummary,
                      pageWeeklySummary?.applied,
                    )}
              </Typography>
            </Box>
            <Box
              sx={{
                p: 1.5,
                backgroundColor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {isDaily ? "Released Today" : "Weekly Remaining"}
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {isDaily
                  ? formatCurrency(eod.totalReleased)
                  : formatWeeklyCurrency(
                      pageWeeklySummary,
                      pageWeeklySummary?.remaining,
                    )}
              </Typography>
            </Box>
          </Box>
          <WeeklyFinancialNotes summary={pageWeeklySummary} />
        </Box>
        <Button
          variant="outlined"
          startIcon={
            exportingAll ? <CircularProgress size={16} /> : <FileDownload />
          }
          onClick={handleExportAllCollections}
          disabled={exportingAll || loading || data.length === 0}
          sx={{
            minHeight: 44,
            alignSelf: { xs: "stretch", md: "flex-start" },
          }}
        >
          {exportingAll
            ? "Exporting Current Results..."
            : "Export Current Results"}
        </Button>
      </Box>

      {/* Export Error Alert */}
      {supportingDataError && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {supportingDataError}
        </Alert>
      )}

      {exportError && (
        <Alert
          severity="error"
          sx={{ mb: 3, borderRadius: 2 }}
          onClose={() => setExportError(null)}
        >
          {exportError}
        </Alert>
      )}

      {/* Individual Collection Cards */}
      {displayedData.map((group) => (
        <Card
          key={group.centerId}
          elevation={0}
          sx={{
            mb: 2,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          {/* Center Header */}
          <Box
            sx={{
              p: { xs: 2, sm: 2.5 },
              backgroundColor: "action.hover",
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={8}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                  {group.centerName}
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    flexWrap: "wrap",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <CalendarToday
                      sx={{ fontSize: 16, color: "text.secondary" }}
                    />
                    <Typography variant="body2">
                      {group.collectionDay}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <LocationOn
                      sx={{ fontSize: 16, color: "text.secondary" }}
                    />
                    <Typography variant="body2">
                      {group.collectionDate}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
                  <Typography variant="body2" color="text.secondary">
                    Weekly Due
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 700, mb: 0.5, color: "primary.main" }}
                  >
                    {formatWeeklyCurrency(
                      getGroupWeeklySummary(group),
                      getGroupWeeklySummary(group)?.due,
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Applied to Week:{" "}
                    {formatWeeklyCurrency(
                      getGroupWeeklySummary(group),
                      getGroupWeeklySummary(group)?.applied,
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Weekly Remaining:{" "}
                    {formatWeeklyCurrency(
                      getGroupWeeklySummary(group),
                      getGroupWeeklySummary(group)?.remaining,
                    )}
                  </Typography>
                  <LoanConditionSummary
                    members={getMembersFor(group.centerId)}
                  />
                  <WeeklyFinancialNotes
                    summary={getGroupWeeklySummary(group)}
                  />
                </Box>
              </Grid>
            </Grid>
          </Box>

          <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
            {/* Statistics Cards */}
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              <Grid item xs={6} md={2.4}>
                <CollectionStatsCard
                  title="Total Members"
                  value={getOperationalMemberCount(group)}
                  icon={<People />}
                  color="primary"
                />
              </Grid>
              <Grid item xs={6} md={2.4}>
                <CollectionStatsCard
                  title="Paid"
                  value={getPaidCount(group)}
                  icon={<CheckCircle />}
                  color="success"
                />
              </Grid>
              <Grid item xs={6} md={2.4}>
                <CollectionStatsCard
                  title="Partial"
                  value={getPartialCount(group)}
                  icon={<Warning />}
                  color="warning"
                />
              </Grid>
              <Grid item xs={6} md={2.4}>
                <CollectionStatsCard
                  title="Pending"
                  value={getPendingCount(group)}
                  icon={<HourglassEmpty />}
                  color="info"
                />
              </Grid>
              <Grid item xs={6} md={2.4}>
                <CollectionStatsCard
                  title="Unpaid"
                  value={getUnpaidCount(group)}
                  icon={<Warning />}
                  color="error"
                />
              </Grid>
            </Grid>

            {/* View Details Button */}
            <Box sx={{ textAlign: "right" }}>
              <Button
                variant="contained"
                startIcon={<Visibility />}
                onClick={() => onViewDetails(group)}
                sx={{ minHeight: 44 }}
              >
                View Details
              </Button>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
