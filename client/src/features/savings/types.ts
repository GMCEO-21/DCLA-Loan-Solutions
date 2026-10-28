export type SavingsHistoryScope = "ledger" | "legacy";

export interface SavingsSummary {
  entries: Array<{
    id: string;
    borrowerId: string | null;
    loanId: string | null;
    amount: number;
    remarks: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  totalDeposits: number;
  currentSavings: number;
  activeLoanId: string | null;
  hasActiveLoan: boolean;
  activeLoanSavings: number;
}

export type SavingsEventType =
  | "opening_balance"
  | "loan_origination_contribution"
  | "reloan_contribution"
  | "manual_deposit"
  | "manual_withdrawal"
  | "repayment_debit"
  | "repayment_reversal_credit";

export interface SavingsHistoryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SavingsHistoryActor {
  id: string;
  name: string;
}

export interface SavingsLedgerHistoryItem {
  recordClass: "ledger";
  id: string;
  eventType: SavingsEventType;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  businessDate: string;
  createdAt: string;
  remarks: string | null;
  loanId: string | null;
  performedBy: SavingsHistoryActor | null;
  referenceType: string | null;
  referenceId: string | null;
  reversalOfId: string | null;
}

export interface SavingsLegacyHistoryItem {
  recordClass: "legacy";
  id: string;
  amount: string;
  direction: "credit" | "debit" | null;
  createdAt: string;
  remarks: string | null;
}

export interface SavingsLedgerHistoryResponse {
  scope: "ledger";
  items: SavingsLedgerHistoryItem[];
  pagination: SavingsHistoryPagination;
}

export interface SavingsLegacyHistoryResponse {
  scope: "legacy";
  items: SavingsLegacyHistoryItem[];
  pagination: SavingsHistoryPagination;
}

export type SavingsHistoryResponse =
  | SavingsLedgerHistoryResponse
  | SavingsLegacyHistoryResponse;

export interface SavingsHistoryParams {
  memberId: string;
  scope: SavingsHistoryScope;
  page?: number;
  limit?: number;
}
