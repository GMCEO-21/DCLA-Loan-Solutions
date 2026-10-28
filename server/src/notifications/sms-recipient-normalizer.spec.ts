import { SmsRecipientNormalizer } from './sms-recipient-normalizer';

describe('SmsRecipientNormalizer', () => {
  const normalizer = new SmsRecipientNormalizer();

  it.each([
    ['09171234567', '+639171234567'],
    ['639171234567', '+639171234567'],
    ['+639171234567', '+639171234567'],
    ['(0917) 123-4567', '+639171234567'],
  ])('normalizes %s to E.164', (input, expected) => {
    expect(normalizer.normalize(input)).toMatchObject({
      valid: true,
      recipient: expected,
      maskedRecipient: '+639****4567',
    });
  });

  it('distinguishes a missing number', () => {
    expect(normalizer.normalize('  ')).toMatchObject({
      valid: false,
      code: 'MISSING_CONTACT_NUMBER',
    });
  });

  it.each(['12345', '+638171234567', '0917123456', '091712345678'])(
    'rejects invalid Philippine mobile number %s',
    (input) => {
      expect(normalizer.normalize(input)).toMatchObject({
        valid: false,
        code: 'INVALID_CONTACT_NUMBER',
      });
    },
  );
});
