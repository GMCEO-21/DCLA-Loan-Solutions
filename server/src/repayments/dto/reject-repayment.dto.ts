import { IsOptional, IsString } from 'class-validator';

export class RejectRepaymentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
