import api from "@utils/api";
import type {
  RecentSmsActivityResult,
  SmsBatchResult,
  SmsCreditsResponse,
  SmsEligibilityItem,
  SmsRequestResult,
  SmsStatusResult,
} from "./types";

export const smsNotificationsApi = {
  getCredits: async (signal?: AbortSignal): Promise<SmsCreditsResponse> => {
    const response = await api.get("/notifications/sms/credits", { signal });
    return response.data;
  },

  getRecent: async (
    limit = 10,
    signal?: AbortSignal,
  ): Promise<RecentSmsActivityResult> => {
    const response = await api.get("/notifications/sms/recent", {
      params: { limit },
      signal,
    });
    return response.data;
  },

  getLoanEligibility: async (loanId: string): Promise<SmsEligibilityItem> => {
    const response = await api.get(
      `/loans/${loanId}/notifications/sms/eligibility`,
    );
    return response.data;
  },

  getRepaymentEligibility: async (
    repaymentIds: string[],
  ): Promise<SmsEligibilityItem[]> => {
    const response = await api.post(
      "/repayments/notifications/sms/eligibility",
      {
        repaymentIds,
      },
    );
    return response.data;
  },

  requestLoanSms: async (loanId: string): Promise<SmsRequestResult> => {
    const response = await api.post(`/loans/${loanId}/notifications/sms`);
    return response.data;
  },

  requestRepaymentBatch: async (
    repaymentIds: string[],
  ): Promise<SmsBatchResult> => {
    const response = await api.post("/repayments/notifications/sms/batch", {
      repaymentIds,
    });
    return response.data;
  },

  getStatus: async (
    notificationId: string,
    signal?: AbortSignal,
  ): Promise<SmsStatusResult> => {
    const response = await api.get(`/notifications/sms/${notificationId}`, {
      signal,
    });
    return response.data;
  },
};
