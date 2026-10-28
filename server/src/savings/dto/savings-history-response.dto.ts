import { SavingsEventType } from '../savings.entity';
import { SavingsHistoryScope } from './savings-history-query.dto';

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

export interface LedgerSavingsHistoryItem {
  recordClass: SavingsHistoryScope.LEDGER;
  id: string;
  eventType: SavingsEventType;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  businessDate: string;
  createdAt: Date;
  remarks: string | null;
  loanId: string | null;
  performedBy: SavingsHistoryActor | null;
  referenceType: string | null;
  referenceId: string | null;
  reversalOfId: string | null;
}

export interface LegacySavingsHistoryItem {
  recordClass: SavingsHistoryScope.LEGACY;
  id: string;
  amount: string;
  direction: 'credit' | 'debit' | null;
  createdAt: Date;
  remarks: string | null;
}

export interface LedgerSavingsHistoryResponse {
  scope: SavingsHistoryScope.LEDGER;
  items: LedgerSavingsHistoryItem[];
  pagination: SavingsHistoryPagination;
}

export interface LegacySavingsHistoryResponse {
  scope: SavingsHistoryScope.LEGACY;
  items: LegacySavingsHistoryItem[];
  pagination: SavingsHistoryPagination;
}

export type SavingsHistoryResponse =
  | LedgerSavingsHistoryResponse
  | LegacySavingsHistoryResponse;
