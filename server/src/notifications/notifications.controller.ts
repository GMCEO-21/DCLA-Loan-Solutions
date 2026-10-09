import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ROLE } from '../auth/roles.constants';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { RecentSmsQueryDto } from './dto/recent-sms-query.dto';
import { RepaymentSmsBatchDto } from './dto/repayment-sms-batch.dto';
import { UniSmsWebhookDto } from './dto/unisms-webhook.dto';
import { NotificationsService } from './notifications.service';

type AuthenticatedRequest = { user?: { userId?: string } };

@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Roles(ROLE.LoanProcessor)
  @Get('loans/:loanId/notifications/sms/eligibility')
  getLoanEligibility(@Param('loanId', new ParseUUIDPipe()) loanId: string) {
    return this.notifications.getLoanEligibility(loanId);
  }

  @Roles(ROLE.LoanProcessor)
  @Post('loans/:loanId/notifications/sms')
  @HttpCode(HttpStatus.ACCEPTED)
  requestLoanSms(
    @Param('loanId', new ParseUUIDPipe()) loanId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notifications.requestLoanSms(loanId, request.user?.userId);
  }

  @Roles(ROLE.Manager)
  @Post('repayments/notifications/sms/eligibility')
  getRepaymentEligibility(@Body() body: RepaymentSmsBatchDto) {
    return this.notifications.getRepaymentEligibility(body.repaymentIds);
  }

  @Roles(ROLE.Manager)
  @Post('repayments/:repaymentId/notifications/sms')
  @HttpCode(HttpStatus.ACCEPTED)
  requestRepaymentSms(
    @Param('repaymentId', new ParseUUIDPipe()) repaymentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notifications.requestRepaymentSms(
      repaymentId,
      request.user?.userId,
    );
  }

  @Roles(ROLE.Manager)
  @Post('repayments/notifications/sms/batch')
  @HttpCode(HttpStatus.ACCEPTED)
  requestRepaymentBatch(
    @Body() body: RepaymentSmsBatchDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notifications.requestRepaymentBatch(
      body.repaymentIds,
      request.user?.userId,
    );
  }

  @Roles(ROLE.Manager)
  @Get('notifications/sms/recent')
  getRecentSms(@Query() query: RecentSmsQueryDto) {
    return this.notifications.getRecentSms(query.limit);
  }

  @Roles(ROLE.Manager)
  @Get('notifications/sms/credits')
  getSmsCredits() {
    return this.notifications.getSmsCredits();
  }

  @Roles(ROLE.LoanProcessor, ROLE.Manager)
  @Get('notifications/sms/:notificationId')
  getStatus(
    @Param('notificationId', new ParseUUIDPipe()) notificationId: string,
  ) {
    return this.notifications.getStatus(notificationId);
  }

  @Public()
  @Post('notifications/sms/webhooks/unisms')
  handleUniSmsWebhook(
    @Headers('webhook-secret-key') webhookSecret: string | undefined,
    @Body() payload: UniSmsWebhookDto,
  ) {
    return this.notifications.applyUniSmsWebhook(webhookSecret, payload);
  }
}
