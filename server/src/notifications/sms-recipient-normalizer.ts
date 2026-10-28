import { Injectable } from '@nestjs/common';

export type SmsRecipientFailureCode =
  | 'MISSING_CONTACT_NUMBER'
  | 'INVALID_CONTACT_NUMBER';

export type SmsRecipientResult =
  | { valid: true; recipient: string; maskedRecipient: string }
  | {
      valid: false;
      code: SmsRecipientFailureCode;
      message: string;
      maskedRecipient: null;
    };

@Injectable()
export class SmsRecipientNormalizer {
  normalize(value: string | null | undefined): SmsRecipientResult {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) {
      return {
        valid: false,
        code: 'MISSING_CONTACT_NUMBER',
        message: 'The member does not have a contact number.',
        maskedRecipient: null,
      };
    }

    const compact = trimmed.replace(/[\s\-().]/g, '');
    let recipient: string | null = null;

    if (/^09\d{9}$/.test(compact)) {
      recipient = `+63${compact.slice(1)}`;
    } else if (/^639\d{9}$/.test(compact)) {
      recipient = `+${compact}`;
    } else if (/^\+639\d{9}$/.test(compact)) {
      recipient = compact;
    }

    if (!recipient) {
      return {
        valid: false,
        code: 'INVALID_CONTACT_NUMBER',
        message:
          'The member contact number is not a valid Philippine mobile number.',
        maskedRecipient: null,
      };
    }

    return {
      valid: true,
      recipient,
      maskedRecipient: this.mask(recipient)!,
    };
  }

  mask(recipient: string | null | undefined): string | null {
    if (!recipient) return null;
    const compact = recipient.replace(/[\s\-().]/g, '');
    if (compact.length < 8) return null;
    return `${compact.slice(0, 4)}****${compact.slice(-4)}`;
  }
}
