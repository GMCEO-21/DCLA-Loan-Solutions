import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repayment } from './repayment.entity';
import { RepaymentsService } from './repayments.service';
import { RepaymentsController } from './repayments.controller';
import { Loan } from '../loans/loan.entity';
import { Member } from '../members/entities/member.entity';
import { Center } from '../centers/entities/center.entity';
import { Collection } from '../collections/entities/collection.entity';
import { LoansModule } from '../loans/loans.module';
import { LoanRepaymentSchedule } from './entities/loan-repayment-schedule.entity';
import { LoanRepaymentAllocation } from './entities/loan-repayment-allocation.entity';
import { Savings } from '../savings/savings.entity';
import { CollectionBatch } from './entities/collection-batch.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Repayment,
      Loan,
      Member,
      Center,
      Collection,
      LoanRepaymentSchedule,
      LoanRepaymentAllocation,
      Savings,
      CollectionBatch,
    ]),
    LoansModule,
  ],
  providers: [RepaymentsService],
  controllers: [RepaymentsController],
  exports: [TypeOrmModule],
})
export class RepaymentsModule {}
