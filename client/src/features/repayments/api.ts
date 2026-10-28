import api from "@utils/api";
import type {
  PendingCollectionApprovalResult,
  PendingRepaymentCollectionGroup,
  Repayment,
  RepaymentAllocationPreview,
} from "./types";

export const repaymentsService = {
  getPending: async (): Promise<Repayment[]> => {
    const response = await api.get("/repayments/pending");
    return response.data;
  },
  getPendingCollections: async (): Promise<
    PendingRepaymentCollectionGroup[]
  > => {
    const response = await api.get("/repayments/pending/collections");
    return response.data;
  },
  getPendingForCollection: async (
    centerId: string,
    collectionDate: string,
  ): Promise<Repayment[]> => {
    const response = await api.get(
      `/repayments/pending/collections/${centerId}/${collectionDate}/repayments`,
    );
    return response.data;
  },
  getAllocationPreview: async (
    repaymentId: string,
  ): Promise<RepaymentAllocationPreview> => {
    const response = await api.get(
      `/repayments/${repaymentId}/allocation-preview`,
    );
    return response.data;
  },
  requestReversal: async (
    repaymentId: string,
    reason?: string,
  ): Promise<Repayment> => {
    const response = await api.post(
      `/repayments/${repaymentId}/reversal-request`,
      {
        reason,
      },
    );
    return response.data;
  },
  approve: async (id: string): Promise<Repayment> => {
    const response = await api.post(`/repayments/${id}/approve`);
    return response.data;
  },
  reject: async (id: string, reason?: string): Promise<Repayment> => {
    const response = await api.post(`/repayments/${id}/reject`, {
      reason,
    });
    return response.data;
  },
  approveCollection: async (
    centerId: string,
    collectionDate: string,
  ): Promise<PendingCollectionApprovalResult> => {
    const response = await api.post("/repayments/pending/collections/approve", {
      centerId,
      collectionDate,
    });
    return response.data;
  },
  rejectCollection: async (
    centerId: string,
    collectionDate: string,
    reason?: string,
  ): Promise<{
    centerId: string;
    collectionDate: string;
    processedCount: number;
  }> => {
    const response = await api.post("/repayments/pending/collections/reject", {
      centerId,
      collectionDate,
      reason,
    });
    return response.data;
  },
};
