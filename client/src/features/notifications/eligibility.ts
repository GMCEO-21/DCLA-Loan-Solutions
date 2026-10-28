import type { Repayment } from "@features/repayments/types";

export const shouldOfferRepaymentSms = (repayment: Repayment): boolean =>
  repayment.status === "approved" && repayment.operationType === "payment";
