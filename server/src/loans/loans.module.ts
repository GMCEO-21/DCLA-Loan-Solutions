import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { Loan } from './loan.entity';
import { Member } from '../members/entities/member.entity';
import { Collection } from '../collections/entities/collection.entity';
import { LoanRepaymentSchedule } from '../repayments/entities/loan-repayment-schedule.entity';
import { Savings } from '../savings/savings.entity';
import { LoanWaiver } from './entities/loan-waiver.entity';
import { LoanChargePolicyService } from './loan-charge-policy.service';
import { LoanChargeLedger } from './entities/loan-charge-ledger.entity';
import { LoanChargesService } from './loan-charges.service';
import { LoanChargeSweepService } from './loan-charge-sweep.service';
import { LoanChargeWorkerService } from './loan-charge-worker.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Loan,
      Member,
      Collection,
      LoanRepaymentSchedule,
      Savings,
      LoanWaiver,
      LoanChargeLedger,
    ]),
  ],
  controllers: [LoansController],
  providers: [
    LoansService,
    LoanChargePolicyService,
    LoanChargesService,
    LoanChargeSweepService,
    LoanChargeWorkerService,
  ],
  exports: [
    LoansService,
    LoanChargePolicyService,
    LoanChargesService,
    LoanChargeSweepService,
  ],
})
export class LoansModule {}
