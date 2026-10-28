import {
  IsNumber,
  IsOptional,
  IsUUID,
  IsIn,
  Max,
  Matches,
  Min,
  IsDateString,
} from 'class-validator';

export class CreateLoanDto {
  @IsUUID()
  borrowerId: string;

  @IsNumber()
  principalAmount: number;

  @IsIn([4, 8, 12, 24])
  termWeeks: number;

  @IsOptional()
  @IsNumber()
  @Min(3.33)
  @Max(10)
  monthlyInterestRate?: number;

  // Manual savings amount; required only for a member's first loan (validated in service)
  @IsOptional()
  @IsNumber()
  @Min(0)
  savings?: number;

  // Optional service charge for initial loan; used to compute net cash released
  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceCharge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  notarialFee?: number;

  // Optional loan creation date; defaults to current date if not provided
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'loanCreatedDate must use YYYY-MM-DD format',
  })
  loanCreatedDate?: string;

}
