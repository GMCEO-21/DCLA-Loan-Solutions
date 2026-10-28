import {
  SmsProvider,
  SmsProviderResult,
  SmsProviderSendInput,
} from './sms-provider';

export class FakeSmsProvider implements SmsProvider {
  readonly sent: SmsProviderSendInput[] = [];
  result: SmsProviderResult = {
    providerMessageId: 'fake-message-id',
    status: 'sent',
  };

  send(input: SmsProviderSendInput): Promise<SmsProviderResult> {
    this.sent.push(input);
    return Promise.resolve(this.result);
  }

  getStatus(): Promise<SmsProviderResult> {
    return Promise.resolve(this.result);
  }
}
