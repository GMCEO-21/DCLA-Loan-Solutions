import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ApplyLoanWaiverDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  pastDueInterestWaiver?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  penaltyWaiver?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

