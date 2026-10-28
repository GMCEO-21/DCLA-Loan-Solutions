import { SmsTemplateService } from './sms-template.service';

describe('SmsTemplateService', () => {
  const service = new SmsTemplateService();

  it('builds the approved shortened loan message exactly', () => {
    const message = service.buildLoanCreatedSms({
      clientName: 'Juan Dela Cruz',
      principalAmount: 10_000,
    });

    expect(message).toBe(
      'Dear Juan Dela Cruz,\n\nYour DCLA loan of PHP 10,000.00 is approved. Please contact our office for release details.\n\n- DCLA',
    );
    expect(message).toHaveLength(121);
    expect(message.length).toBeLessThanOrEqual(160);
  });

  it('builds the approved shortened payment message exactly', () => {
    const message = service.buildRepaymentPostedSms({
      clientName: 'Juan Dela Cruz',
      amount: 1_000,
      paymentDate: '2026-08-27',
    });

    expect(message).toBe(
      'Dear Juan Dela Cruz,\n\nYour DCLA payment of PHP 1,000.00 was received on 2026-08-27 and posted successfully. Thank you.\n\n- DCLA',
    );
    expect(message).toHaveLength(126);
    expect(message.length).toBeLessThanOrEqual(160);
  });

  it('formats a payment timestamp using the Asia/Manila calendar date', () => {
    const message = service.buildRepaymentPostedSms({
      clientName: 'Juan Dela Cruz',
      amount: 1_000,
      paymentDate: new Date('2026-08-26T16:30:00.000Z'),
    });

    expect(message).toContain(
      'received on 2026-08-27 and posted successfully.',
    );
  });

  it('preserves a date-only payment date without timezone shifting', () => {
    const message = service.buildRepaymentPostedSms({
      clientName: 'Juan Dela Cruz',
      amount: 1_000,
      paymentDate: '2026-08-27',
    });

    expect(message).toContain(
      'received on 2026-08-27 and posted successfully.',
    );
  });

  it('keeps representative maximum values within the 160-character limit', () => {
    const clientName = 'Mariah Cristina De Los Santos-Reyes';
    const amount = 999_999_999.99;
    const formattedAmount = '999,999,999.99';
    const loanMessage = service.buildLoanCreatedSms({
      clientName,
      principalAmount: amount,
    });
    const paymentMessage = service.buildRepaymentPostedSms({
      clientName,
      amount,
      paymentDate: new Date('2026-08-26T16:30:00.000Z'),
    });

    expect(clientName).toHaveLength(35);
    expect(formattedAmount).toHaveLength(14);
    expect(loanMessage).toContain(`Dear ${clientName},`);
    expect(paymentMessage).toContain(`Dear ${clientName},`);
    expect(loanMessage).toContain(`PHP ${formattedAmount}`);
    expect(paymentMessage).toContain(`PHP ${formattedAmount}`);
    expect(paymentMessage).toContain('received on 2026-08-27');
    expect(loanMessage).toHaveLength(147);
    expect(paymentMessage).toHaveLength(153);
    expect(loanMessage.length).toBeLessThanOrEqual(160);
    expect(paymentMessage.length).toBeLessThanOrEqual(160);
    expect(loanMessage).toContain('\n\n- DCLA');
    expect(paymentMessage).toContain('\n\n- DCLA');
    expect(`${loanMessage}${paymentMessage}`).not.toMatch(/[₱—–]/u);
    expect(
      Array.from(`${loanMessage}${paymentMessage}`).every(
        (character) => (character.codePointAt(0) ?? 0) <= 127,
      ),
    ).toBe(true);
  });
});
