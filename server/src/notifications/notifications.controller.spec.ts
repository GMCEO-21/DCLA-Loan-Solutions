import { HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { NotificationsController } from './notifications.controller';

describe('NotificationsController HTTP semantics', () => {
  it.each([
    'requestLoanSms',
    'requestRepaymentSms',
    'requestRepaymentBatch',
  ] as const)('returns 202 for asynchronous queue endpoint %s', (method) => {
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        NotificationsController.prototype[method],
      ),
    ).toBe(HttpStatus.ACCEPTED);
  });

  it.each([
    'getRepaymentEligibility',
    'getSmsCredits',
    'handleUniSmsWebhook',
  ] as const)(
    'does not change the status code for non-queue endpoint %s',
    (method) => {
      expect(
        Reflect.getMetadata(
          HTTP_CODE_METADATA,
          NotificationsController.prototype[method],
        ),
      ).toBeUndefined();
    },
  );
});
