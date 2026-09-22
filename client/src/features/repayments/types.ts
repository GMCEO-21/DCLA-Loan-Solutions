export type RepaymentStatus = "pending" | "approved" | "rejected";

export interface RepaymentMember {
  id: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  contactNumber?: string | null;
}

export interface RepaymentCenter {
  id: string;
  name?: string;
}

export interface RepaymentLoan {
  id: string;
}

export interface Repayment {
  id: string;
  amount: number;
  notes?: string | null;
  collectionDate?: string | null;
  useSavings?: boolean;
  status: RepaymentStatus;
  operationType?: "payment" | "reversal";
  relatedRepaymentId?: string | null;
  createdAt: string;
  member?: RepaymentMember;
  center?: RepaymentCenter;
  loan?: RepaymentLoan;
  createdById?: string | null;
}

export interface PendingRepaymentCollectionGroup {
  batchId: string | null;
  centerId: string;
  centerName: string;
  collectionDate: string;
  pendingCount: number;
  paymentCount: number;
  reversalCount: number;
  paymentAmount: number;
  reversalAmount: number;
  netAmount: number;
}

export interface PendingCollectionApprovalResult {
  batchId: string | null;
  centerId: string;
  collectionDate: string;
  processedCount: number;
  approvedCount: number;
  approvedPaymentIds: string[];
}

export interface PaymentAllocationBucket {
  amount: number;
  cashPortion: number;
  savingsPortion: number;
}

export interface RepaymentAllocationPreview {
  repaymentId: string;
  loanId: string;
  asOfDate: string;
  allocation: {
    eligible: boolean;
    cashReceived: number;
    savingsUsed: number;
    totalApplied: number;
    penalty: PaymentAllocationBucket;
    pastDueInterest: PaymentAllocationBucket;
    contractual: PaymentAllocationBucket;
    unapplied: number;
  };
}
