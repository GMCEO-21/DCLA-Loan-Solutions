import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateCollectionPaymentDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paymentAmount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
