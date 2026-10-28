export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export type SmsProviderStatus = 'pending' | 'retrying' | 'sent' | 'failed';

export interface SmsProviderSendInput {
  recipient: string;
  content: string;
  notificationId: string;
  idempotencyKey: string;
}

export interface SmsProviderResult {
  providerMessageId: string;
  status: SmsProviderStatus;
  failureReason?: string | null;
}

export interface SmsProvider {
  send(input: SmsProviderSendInput): Promise<SmsProviderResult>;
  getStatus(providerMessageId: string): Promise<SmsProviderResult>;
}

export class SmsProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}
