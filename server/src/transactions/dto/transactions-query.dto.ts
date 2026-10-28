import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TransactionsQueryDto {
  @IsOptional()
  @IsString()
  memberId?: string;

  @IsOptional()
  @IsString()
  centerId?: string;

  @IsOptional()
  @IsString()
  loanId?: string;

  @IsOptional()
  @IsIn([
    'repayment',
    'savings',
    'savings_deposit',
    'savings_withdrawal',
    'all',
  ])
  type?:
    | 'repayment'
    | 'savings'
    | 'savings_deposit'
    | 'savings_withdrawal'
    | 'all';

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 25;
}
