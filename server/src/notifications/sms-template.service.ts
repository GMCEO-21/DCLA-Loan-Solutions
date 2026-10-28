import { Injectable } from '@nestjs/common';

const MAX_SMS_LENGTH = 160;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONEY_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const MANILA_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

@Injectable()
export class SmsTemplateService {
  buildLoanCreatedSms(input: {
    clientName: string;
    principalAmount: number;
  }): string {
    const message = `Dear ${this.name(input.clientName)},\n\nYour DCLA loan of PHP ${this.money(input.principalAmount)} is approved. Please contact our office for release details.\n\n- DCLA`;
    return this.requireValidLength(message);
  }

  buildRepaymentPostedSms(input: {
    clientName: string;
    amount: number;
    paymentDate: Date | string | null;
  }): string {
    const message = `Dear ${this.name(input.clientName)},\n\nYour DCLA payment of PHP ${this.money(input.amount)} was received on ${this.date(input.paymentDate)} and posted successfully. Thank you.\n\n- DCLA`;
    return this.requireValidLength(message);
  }

  private name(value: string): string {
    return (value || 'Member').trim() || 'Member';
  }

  private money(value: number): string {
    return MONEY_FORMATTER.format(Number(value || 0));
  }

  private date(value: Date | string | null): string {
    if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value)) {
      return value;
    }

    const parsed =
      value instanceof Date ? value : value ? new Date(value) : new Date();
    if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);

    const parts = MANILA_DATE_FORMATTER.formatToParts(parsed);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  }

  private requireValidLength(message: string): string {
    if (message.length > MAX_SMS_LENGTH) {
      throw new Error(`SMS template exceeds ${MAX_SMS_LENGTH} characters`);
    }
    return message;
  }
}
