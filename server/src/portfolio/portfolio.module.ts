import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortfolioService } from './portfolio.service';
import { PortfolioController } from './portfolio.controller';
import { Center } from '../centers/entities/center.entity';
import { Loan } from '../loans/loan.entity';
import { LoanRepaymentSchedule } from '../repayments/entities/loan-repayment-schedule.entity';
import { LoanRepaymentAllocation } from '../repayments/entities/loan-repayment-allocation.entity';
import { Repayment } from '../repayments/repayment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Center,
      Loan,
      LoanRepaymentSchedule,
      LoanRepaymentAllocation,
      Repayment,
    ]),
  ],
  providers: [PortfolioService],
  controllers: [PortfolioController],
  exports: [PortfolioService],
})
export class PortfolioModule {}
