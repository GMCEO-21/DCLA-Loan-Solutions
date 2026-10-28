import { IsIn, IsObject, IsString } from 'class-validator';

export class UniSmsWebhookDto {
  @IsString()
  id: string;

  @IsIn(['message.sent', 'message.failed', 'message.retrying'])
  event: 'message.sent' | 'message.failed' | 'message.retrying';

  @IsObject()
  message: {
    reference_id?: string;
    status?: string;
    fail_reason?: string | null;
  };
}
