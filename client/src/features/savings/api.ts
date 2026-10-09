import api from "@utils/api";
import type {
  SavingsHistoryParams,
  SavingsHistoryResponse,
  SavingsSummary,
} from "./types";

export const savingsService = {
  deposit: async (data: {
    memberId: string;
    amount: number;
    remarks?: string;
    loanId?: string;
  }) => {
    const response = await api.post("/savings/deposit", data);
    return response.data;
  },
  withdraw: async (data: {
    memberId: string;
    amount: number;
    remarks?: string;
    loanId?: string;
  }) => {
    const response = await api.post("/savings/withdraw", data);
    return response.data;
  },
  getByMember: async (memberId: string): Promise<SavingsSummary> => {
    const response = await api.get<SavingsSummary>(
      `/savings/member/${memberId}`,
    );
    return response.data;
  },
  getHistory: async ({
    memberId,
    scope,
    page = 1,
    limit = 25,
  }: SavingsHistoryParams): Promise<SavingsHistoryResponse> => {
    const response = await api.get<SavingsHistoryResponse>(
      `/savings/member/${memberId}/history`,
      { params: { scope, page, limit } },
    );
    return response.data;
  },
};

export default savingsService;
