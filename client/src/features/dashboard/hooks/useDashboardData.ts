import { useEffect, useState } from "react";
import { portfolioService } from "@features/portfolio/api";
import { collectionsService } from "@features/collections/api";
import { CentersAPI } from "@features/centers/api";
import { MembersAPI } from "@features/member/api";
import type { DailyCollectionGroup } from "@features/collections/types";
import type { PortfolioData } from "@features/portfolio/types";

export interface DashboardStats {
  totalCenters: number;
  totalMembers: number;
  totalAmountDisbursed: number;
  totalOutstandingCollection: number;
  totalInterestIncome: number;
  dailyCollections: number;
  totalCollectedToday: number;
  pendingCollectionsToday: number;
  centersWithCollectionsToday: number;
  collectionRate: number;
  activeLoans: number;
  outstandingRatio: number;
  topCentersByOutstanding: DashboardCenterMetric[];
  todayCollectionActivity: DashboardCollectionActivity[];
  riskBands: DashboardRiskBands;
}

export interface DashboardCenterMetric {
  rank: number;
  centerName: string;
  amountDisbursed: number;
  outstandingCollection: number;
  outstandingRatio: number;
}

export interface DashboardCollectionActivity {
  centerId: string;
  centerName: string;
  collectionDate: string;
  totalAmount: number;
  totalReceived: number;
  totalMembers: number;
  pendingCollections: number;
}

export interface DashboardRiskBands {
  low: number;
  medium: number;
  high: number;
}

const toNumber = (value: unknown): number => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const buildCenterMetrics = (centers: PortfolioData[]): DashboardCenterMetric[] =>
  [...centers]
    .map((center) => {
      const disbursed = toNumber(center.amountDisbursed);
      const outstanding = toNumber(center.outstandingCollection);
      const ratio = disbursed > 0 ? (outstanding / disbursed) * 100 : 0;

      return {
        centerName: center.centerName,
        amountDisbursed: disbursed,
        outstandingCollection: outstanding,
        outstandingRatio: ratio,
      };
    })
    .sort(
      (a, b) =>
        b.outstandingCollection - a.outstandingCollection ||
        b.amountDisbursed - a.amountDisbursed
    )
    .map((center, index) => ({
      ...center,
      rank: index + 1,
    }));

const buildCollectionActivity = (
  dailyGroups: DailyCollectionGroup[]
): DashboardCollectionActivity[] =>
  [...dailyGroups]
    .map((group) => ({
      centerId: group.centerId,
      centerName: group.centerName,
      collectionDate: group.collectionDate,
      totalAmount: toNumber(group.totalAmount),
      totalReceived: toNumber(group.totalReceived),
      totalMembers: toNumber(group.totalMembers),
      pendingCollections: toNumber(group.pendingCollections),
    }))
    .sort((a, b) => b.totalReceived - a.totalReceived);

const buildRiskBands = (centers: DashboardCenterMetric[]): DashboardRiskBands =>
  centers.reduce<DashboardRiskBands>(
    (acc, center) => {
      if (center.amountDisbursed <= 0) {
        return acc;
      }

      if (center.outstandingRatio >= 60) {
        acc.high += 1;
      } else if (center.outstandingRatio >= 30) {
        acc.medium += 1;
      } else {
        acc.low += 1;
      }
      return acc;
    },
    { low: 0, medium: 0, high: 0 }
  );

export function useDashboardData() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        portfolioData,
        collectionsData,
        centersData,
        membersData,
      ] = await Promise.all([
        portfolioService.getPortfolioData(),
        collectionsService.getTodayCollections(),
        CentersAPI.getAll({ page: 1, limit: 1 }),
        MembersAPI.getAll({ page: 1, limit: 1 }),
      ]);

      const totalAmountDisbursed = toNumber(portfolioData.totalAmountDisbursed);
      const totalOutstandingCollection = toNumber(
        portfolioData.totalOutstandingCollection
      );
      const rawCollectionRate =
        totalAmountDisbursed > 0
          ? ((totalAmountDisbursed - totalOutstandingCollection) /
              totalAmountDisbursed) *
            100
          : 0;
      const collectionRate = Math.min(100, Math.max(0, rawCollectionRate));

      const centerMetrics = buildCenterMetrics(portfolioData.centers ?? []);
      const todayCollectionActivity = buildCollectionActivity(collectionsData ?? []);
      const totalCollectedToday = todayCollectionActivity.reduce(
        (sum, group) => sum + group.totalReceived,
        0
      );
      const pendingCollectionsToday = todayCollectionActivity.reduce(
        (sum, group) => sum + group.pendingCollections,
        0
      );

      const riskBands = buildRiskBands(centerMetrics);

      const dashboardStats: DashboardStats = {
        totalCenters: toNumber(centersData.total ?? centersData.items?.length),
        totalMembers: toNumber(membersData.total ?? membersData.items?.length),
        totalAmountDisbursed,
        totalOutstandingCollection,
        totalInterestIncome: totalAmountDisbursed * 0.2,
        dailyCollections: todayCollectionActivity.length,
        totalCollectedToday,
        pendingCollectionsToday,
        centersWithCollectionsToday: todayCollectionActivity.length,
        collectionRate,
        activeLoans: centerMetrics.filter(
          (center) => center.outstandingCollection > 0
        ).length,
        outstandingRatio:
          totalAmountDisbursed > 0
            ? Math.max(0, (totalOutstandingCollection / totalAmountDisbursed) * 100)
            : 0,
        topCentersByOutstanding: centerMetrics.slice(0, 8),
        todayCollectionActivity,
        riskBands,
      };

      setStats(dashboardStats);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch dashboard data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return {
    stats,
    loading,
    error,
    refetch: fetchDashboardData,
  };
}
