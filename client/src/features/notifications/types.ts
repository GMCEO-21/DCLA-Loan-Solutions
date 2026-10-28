export type SmsEventType = "loan_created" | "repayment_posted";
export type SmsNotificationStatus =
  "pending" | "processing" | "sent" | "failed";

export interface SmsEligibilityItem {
  resourceId: string;
  memberName: string;
  amount: number;
  recipientMasked: string | null;
  eligible: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  notificationId: string | null;
  notificationStatus: SmsNotificationStatus | null;
}

export interface SmsRequestResult extends SmsEligibilityItem {
  eventType: SmsEventType;
  created: boolean;
  status: SmsNotificationStatus;
}

export interface SmsBatchResult {
  items: SmsRequestResult[];
  summary: {
    selected: number;
    queued: number;
    alreadySent: number;
    invalidContact: number;
    missingContact: number;
    ineligible: number;
  };
}

export interface SmsStatusResult {
  notificationId: string;
  eventType: SmsEventType;
  status: SmsNotificationStatus;
  recipientMasked: string | null;
  sentAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface RecentSmsActivityItem {
  notificationId: string;
  memberName: string;
  eventType: SmsEventType;
  status: SmsNotificationStatus;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
}

export interface RecentSmsActivityResult {
  items: RecentSmsActivityItem[];
  summary: {
    sentToday: number;
    pending: number;
    failedToday: number;
  };
}

export interface SmsCreditsResponse {
  credits: number;
}
