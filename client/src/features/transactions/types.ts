export type TransactionType =
  "repayment" | "savings_deposit" | "savings_withdrawal";

export interface TransactionHistoryItem {
  id: string;
  type: TransactionType;
  amount: number;
  direction: "credit" | "debit";
  member: {
    id: string | null;
    name: string;
    center?: {
      id: string | null;
      name: string | null;
    };
  };
  loan?: {
    id: string | null;
    status?: string | null;
  };
  notes?: string | null;
  createdAt: string;
  collectionDate?: string | null;
  source: "repayment" | "savings";
  repaymentOperationType?: "payment" | "reversal" | null;
  canReverse: boolean;
}

export interface TransactionHistoryResponse {
  items: TransactionHistoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type TransactionFilterType =
  "all" | "repayment" | "savings" | "savings_deposit" | "savings_withdrawal";
