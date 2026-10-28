import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum SavingsHistoryScope {
  LEDGER = 'ledger',
  LEGACY = 'legacy',
}

export class SavingsHistoryQueryDto {
  @IsEnum(SavingsHistoryScope)
  scope: SavingsHistoryScope;

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
