import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { Repayment } from '../repayments/repayment.entity';
import { Savings } from '../savings/savings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Repayment, Savings])],
  providers: [TransactionsService],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
