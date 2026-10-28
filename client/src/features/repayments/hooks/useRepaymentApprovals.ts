import { useCallback, useEffect, useState } from "react";
import { repaymentsService } from "../api";
import type { PendingRepaymentCollectionGroup } from "../types";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
};

export function useRepaymentApprovals() {
  const [pendingCollections, setPendingCollections] = useState<
    PendingRepaymentCollectionGroup[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingIds, setActingIds] = useState<Set<string>>(new Set());

  const getActionKey = (
    centerId: string,
    collectionDate: string,
    batchId?: string | null
  ) => `${batchId ?? "legacy"}::${centerId}::${collectionDate}`;

  const updateActing = (actionKey: string, isActing: boolean) => {
    setActingIds((prev) => {
      const next = new Set(prev);
      if (isActing) {
        next.add(actionKey);
      } else {
        next.delete(actionKey);
      }
      return next;
    });
  };

  const fetchPendingCollections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await repaymentsService.getPendingCollections();
      setPendingCollections(data);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load pending collections."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingCollections();
  }, [fetchPendingCollections]);

  const approveCollection = async (
    centerId: string,
    collectionDate: string,
    batchId?: string | null
  ) => {
    const actionKey = getActionKey(centerId, collectionDate, batchId);
    updateActing(actionKey, true);
    try {
      const result = await repaymentsService.approveCollection(centerId, collectionDate);
      setPendingCollections((prev) =>
        prev.filter(
          (item) =>
            !(item.centerId === centerId && item.collectionDate === collectionDate)
        )
      );
      return result;
    } finally {
      updateActing(actionKey, false);
    }
  };

  const rejectCollection = async (
    centerId: string,
    collectionDate: string,
    reason?: string,
    batchId?: string | null
  ) => {
    const actionKey = getActionKey(centerId, collectionDate, batchId);
    updateActing(actionKey, true);
    try {
      await repaymentsService.rejectCollection(centerId, collectionDate, reason);
      setPendingCollections((prev) =>
        prev.filter(
          (item) =>
            !(item.centerId === centerId && item.collectionDate === collectionDate)
        )
      );
    } finally {
      updateActing(actionKey, false);
    }
  };

  return {
    pendingCollections,
    loading,
    error,
    actingIds,
    getActionKey,
    refresh: fetchPendingCollections,
    approveCollection,
    rejectCollection,
  };
}
