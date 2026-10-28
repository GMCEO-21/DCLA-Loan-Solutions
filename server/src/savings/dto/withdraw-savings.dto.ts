import { Type } from 'class-transformer';
import {
  IsUUID,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';

export class WithdrawSavingsDto {
  @IsUUID()
  memberId: string;

  @IsOptional()
  @IsUUID()
  loanId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01, { message: 'amount must be greater than 0' })
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remarks?: string;
}
