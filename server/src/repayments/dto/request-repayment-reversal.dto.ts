import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestRepaymentReversalDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
