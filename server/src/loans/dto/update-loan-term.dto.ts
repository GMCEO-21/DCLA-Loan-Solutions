import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateLoanTermDto {
  @IsNumber()
  @IsIn([4, 8, 12, 24], {
    message: 'termWeeks must be one of 4, 8, 12, or 24 weeks',
  })
  termWeeks: number;

  @IsOptional()
  @IsNumber()
  @Min(3.33)
  @Max(10)
  monthlyInterestRate?: number;
}
