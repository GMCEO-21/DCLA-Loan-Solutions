import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Loan } from '../loans/loan.entity';
import { Member } from '../members/entities/member.entity';
import { Repayment } from '../repayments/repayment.entity';
import { User } from '../users/user.entity';
import { SmsNotification } from './entities/sms-notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SMS_PROVIDER } from './providers/sms-provider';
import { UniSmsProvider } from './providers/unisms.provider';
import { SmsRecipientNormalizer } from './sms-recipient-normalizer';
import { SmsTemplateService } from './sms-template.service';
import { SmsWorkerService } from './sms-worker.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SmsNotification, Loan, Repayment, Member, User]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    SmsRecipientNormalizer,
    SmsTemplateService,
    SmsWorkerService,
    UniSmsProvider,
    { provide: SMS_PROVIDER, useExisting: UniSmsProvider },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
