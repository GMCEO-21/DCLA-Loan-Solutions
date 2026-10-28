import api from "@utils/api";
import type {
  TransactionHistoryResponse,
  TransactionFilterType,
} from "./types";

export type TransactionHistoryQuery = {
  page?: number;
  limit?: number;
  type?: TransactionFilterType | "all";
  memberId?: string;
  centerId?: string;
  loanId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
};

export const transactionHistoryQueryKey = (query: TransactionHistoryQuery) => [
  "transactions",
  query.page ?? 1,
  query.limit ?? 25,
  query.search ?? "",
  query.type ?? "all",
  query.memberId ?? "",
  query.centerId ?? "",
  query.loanId ?? "",
  query.startDate ?? "",
  query.endDate ?? "",
];

export const TransactionsAPI = {
  async getHistory(
    params: TransactionHistoryQuery = {},
    signal?: AbortSignal,
  ): Promise<TransactionHistoryResponse> {
    const response = await api.get("/transactions", { params, signal });
    return response.data;
  },
};
