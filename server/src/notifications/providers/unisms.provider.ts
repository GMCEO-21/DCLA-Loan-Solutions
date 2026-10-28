import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SmsProvider,
  SmsProviderError,
  SmsProviderResult,
  SmsProviderSendInput,
  SmsProviderStatus,
} from './sms-provider';

interface UniSmsMessageResponse {
  message?:
    | {
        reference_id?: string;
        status?: string;
        fail_reason?: string | null;
      }
    | string;
  error?: { code?: unknown; message?: unknown } | string;
  code?: unknown;
  reason?: unknown;
  fail_reason?: unknown;
}

interface UniSmsAccountResponse {
  sms_credits?: unknown;
}

export interface SmsCreditsResult {
  credits: number;
}

@Injectable()
export class UniSmsProvider implements SmsProvider {
  constructor(private readonly config: ConfigService) {}

  async send(input: SmsProviderSendInput): Promise<SmsProviderResult> {
    this.requireEnabled();
    return this.request('/sms', {
      method: 'POST',
      body: JSON.stringify({
        recipient: input.recipient,
        content: input.content,
        sender_id: this.requiredConfig('UNISMS_SENDER_ID'),
        metadata: {
          notification_id: input.notificationId,
          idempotency_key: input.idempotencyKey,
        },
      }),
    });
  }

  async getStatus(providerMessageId: string): Promise<SmsProviderResult> {
    this.requireEnabled();
    return this.request(`/sms/${encodeURIComponent(providerMessageId)}`, {
      method: 'GET',
    });
  }

  async getCredits(): Promise<SmsCreditsResult> {
    this.requireEnabled();
    const data = await this.requestJson<UniSmsAccountResponse>('/account', {
      method: 'GET',
    });
    const credits = data.sms_credits;

    if (
      typeof credits !== 'number' ||
      !Number.isFinite(credits) ||
      !Number.isSafeInteger(credits) ||
      credits < 0
    ) {
      throw new SmsProviderError(
        'UNISMS_INVALID_ACCOUNT_RESPONSE',
        'UniSMS returned an invalid account response.',
        false,
      );
    }

    return { credits };
  }

  private async request(
    path: string,
    init: RequestInit,
  ): Promise<SmsProviderResult> {
    const data = await this.requestJson<UniSmsMessageResponse>(path, init);

    const message =
      data.message && typeof data.message === 'object'
        ? data.message
        : undefined;
    const providerMessageId = message?.reference_id;
    if (!providerMessageId) {
      throw new SmsProviderError(
        'UNISMS_INVALID_RESPONSE',
        'UniSMS did not return a message reference.',
        true,
      );
    }

    return {
      providerMessageId,
      status: this.mapStatus(message?.status),
      failureReason: message?.fail_reason ?? null,
    };
  }

  private async requestJson<T>(path: string, init: RequestInit): Promise<T> {
    const secret = this.requiredConfig('UNISMS_API_SECRET');
    const baseUrl = (
      this.config.get<string>('UNISMS_BASE_URL') || 'https://unismsapi.com/api'
    ).replace(/\/$/, '');
    const timeoutMs = this.numberConfig('SMS_REQUEST_TIMEOUT_MS', 10_000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });
      const data = (await response.json().catch(() => ({}))) as T;

      if (!response.ok) {
        throw this.httpError(response.status, data as UniSmsMessageResponse);
      }

      return data;
    } catch (error) {
      if (error instanceof SmsProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new SmsProviderError(
          'UNISMS_TIMEOUT',
          'UniSMS request timed out.',
          true,
        );
      }
      throw new SmsProviderError(
        'UNISMS_NETWORK_ERROR',
        'UniSMS could not be reached.',
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private httpError(
    status: number,
    data: UniSmsMessageResponse,
  ): SmsProviderError {
    const providerCode = this.providerCode(data);
    const providerReason = this.providerReason(data);
    const diagnostic = providerReason ? `: ${providerReason}` : '';
    if (status === 401 || status === 403) {
      return new SmsProviderError(
        this.errorCode('UNISMS_AUTHENTICATION_FAILED', providerCode),
        `UniSMS authentication failed (HTTP ${status})${diagnostic}.`,
        false,
      );
    }
    if (status === 400 || status === 422) {
      return new SmsProviderError(
        this.errorCode('UNISMS_REQUEST_REJECTED', providerCode),
        `UniSMS rejected the message request (HTTP ${status})${diagnostic}.`,
        false,
      );
    }
    return new SmsProviderError(
      this.errorCode(
        status === 429 ? 'UNISMS_RATE_LIMITED' : 'UNISMS_UNAVAILABLE',
        providerCode,
      ),
      `UniSMS is temporarily unavailable (HTTP ${status})${diagnostic}.`,
      status === 429 || status >= 500,
    );
  }

  private mapStatus(value: string | undefined): SmsProviderStatus {
    if (
      value === 'sent' ||
      value === 'failed' ||
      value === 'retrying' ||
      value === 'pending'
    ) {
      return value;
    }
    const suffix = value ? `: ${this.sanitize(value, 80)}` : '';
    throw new SmsProviderError(
      'UNISMS_UNKNOWN_STATUS',
      `UniSMS returned an unsupported message status${suffix}.`,
      true,
    );
  }

  private providerCode(data: UniSmsMessageResponse): string | null {
    const value =
      data.error && typeof data.error === 'object'
        ? data.error.code
        : data.code;
    if (typeof value !== 'string') return null;
    const safe = this.sanitize(value, 40)
      .toUpperCase()
      .replace(/[^A-Z0-9_.-]/g, '_')
      .slice(0, 40);
    return safe || null;
  }

  private providerReason(data: UniSmsMessageResponse): string | null {
    const errorReason =
      data.error && typeof data.error === 'object'
        ? data.error.message
        : data.error;
    const messageReason =
      typeof data.message === 'string'
        ? data.message
        : data.message?.fail_reason;
    const value =
      errorReason ?? data.reason ?? data.fail_reason ?? messageReason;
    return typeof value === 'string' ? this.sanitize(value, 300) : null;
  }

  private errorCode(base: string, providerCode: string | null): string {
    return providerCode ? `${base}:${providerCode}`.slice(0, 80) : base;
  }

  private sanitize(value: string, maxLength: number): string {
    const secret = this.config.get<string>('UNISMS_API_SECRET') || '';
    const encodedSecret = secret
      ? Buffer.from(`${secret}:`).toString('base64')
      : '';
    let safe = value
      .replace(/[\r\n\t]/g, ' ')
      .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, '[REDACTED_AUTH]')
      .replace(/(?:\+63|0)9\d{9}/g, '[REDACTED_RECIPIENT]');
    for (const sensitive of [secret, encodedSecret]) {
      if (sensitive) safe = safe.split(sensitive).join('[REDACTED]');
    }
    return safe
      .replace(/[^\x20-\x7E]/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  private requiredConfig(key: string): string {
    const value = this.config.get<string>(key)?.trim();
    if (!value) {
      throw new SmsProviderError(
        'SMS_NOT_CONFIGURED',
        'SMS provider configuration is incomplete.',
        false,
      );
    }
    return value;
  }

  private requireEnabled(): void {
    if (this.config.get<string>('SMS_ENABLED') !== 'true') {
      throw new SmsProviderError(
        'SMS_DISABLED',
        'SMS sending is disabled.',
        false,
      );
    }
  }

  private numberConfig(key: string, fallback: number): number {
    const value = Number(this.config.get<string>(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
