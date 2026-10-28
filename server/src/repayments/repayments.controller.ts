import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { RepaymentsService } from './repayments.service';
import { ROLE } from '../auth/roles.constants';
import { Roles } from '../auth/roles.decorator';
import { RejectRepaymentDto } from './dto/reject-repayment.dto';
import { RequestRepaymentReversalDto } from './dto/request-repayment-reversal.dto';
import { ApprovePendingCollectionDto } from './dto/approve-pending-collection.dto';
import { RejectPendingCollectionDto } from './dto/reject-pending-collection.dto';
import { CreateRepaymentDto } from './dto/create-repayment.dto';

@Controller('repayments')
export class RepaymentsController {
  constructor(private readonly repaymentsService: RepaymentsService) {}

  @Roles(ROLE.Cashier)
  @Post()
  create(
    @Body() body: CreateRepaymentDto,
    @Req() req: { user?: { userId?: string; role?: string } },
  ) {
    return this.repaymentsService.create(body, req.user);
  }

  @Roles(ROLE.Cashier)
  @Post(':id/reversal-request')
  requestReversal(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RequestRepaymentReversalDto,
    @Req() req: { user?: { userId?: string; role?: string } },
  ) {
    return this.repaymentsService.requestReversal(id, body, req.user);
  }

  @Roles(ROLE.Manager)
  @Get('pending')
  findPending() {
    return this.repaymentsService.findPendingRepayments();
  }

  @Roles(ROLE.Manager)
  @Get('pending/collections')
  findPendingCollections() {
    return this.repaymentsService.findPendingCollections();
  }

  @Roles(ROLE.Manager, ROLE.Cashier)
  @Get('pending/collections/:centerId/:collectionDate/repayments')
  findPendingRepaymentsForCollection(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Param('collectionDate') collectionDate: string,
  ) {
    return this.repaymentsService.findPendingRepaymentsForCollection(
      centerId,
      collectionDate,
    );
  }

  @Roles(ROLE.Manager)
  @Post('pending/collections/approve')
  approveCollection(
    @Body() body: ApprovePendingCollectionDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.repaymentsService.approvePendingCollection(
      body.centerId,
      body.collectionDate,
      req.user?.userId,
    );
  }

  @Roles(ROLE.Manager)
  @Post('pending/collections/reject')
  rejectCollection(
    @Body() body: RejectPendingCollectionDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.repaymentsService.rejectPendingCollection(
      body.centerId,
      body.collectionDate,
      req.user?.userId,
      body.reason,
    );
  }

  @Roles(ROLE.Manager)
  @Post(':id/approve')
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.repaymentsService.approveRepayment(id, req.user?.userId);
  }

  @Roles(ROLE.Manager)
  @Get(':id/allocation-preview')
  getAllocationPreview(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.repaymentsService.getAllocationPreview(id);
  }

  @Roles(ROLE.Manager)
  @Post(':id/reject')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RejectRepaymentDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.repaymentsService.rejectRepayment(
      id,
      req.user?.userId,
      body.reason,
    );
  }

  @Roles(ROLE.Manager, ROLE.Cashier, ROLE.LoanProcessor)
  @Get('loan/:id/schedule')
  getSchedule(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.repaymentsService.getScheduleForLoan(id);
  }
}
