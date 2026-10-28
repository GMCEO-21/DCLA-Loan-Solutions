import { Controller, Get, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsQueryDto } from './dto/transactions-query.dto';
import { ROLE } from '../auth/roles.constants';
import { Roles } from '../auth/roles.decorator';

@Roles(ROLE.Manager, ROLE.Cashier, ROLE.LoanProcessor)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  getHistory(@Query() query: TransactionsQueryDto) {
    return this.transactionsService.getHistory(query);
  }
}
