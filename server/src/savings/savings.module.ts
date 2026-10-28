import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';
import { Savings } from './savings.entity';
import { Member } from '../members/entities/member.entity';
import { Loan } from '../loans/loan.entity';
import { SavingsHistoryService } from './savings-history.service';
import { LoansModule } from '../loans/loans.module';
import { SavingsLedgerCutoverService } from './savings-ledger-cutover.service';

@Module({
  imports: [TypeOrmModule.forFeature([Savings, Member, Loan]), LoansModule],
  controllers: [SavingsController],
  providers: [
    SavingsService,
    SavingsHistoryService,
    SavingsLedgerCutoverService,
  ],
  exports: [SavingsService, SavingsLedgerCutoverService],
})
export class SavingsModule {}
