import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
  MinLength,
  IsUUID,
} from 'class-validator';

export class FindCollectionsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @IsUUID()
  @IsOptional()
  centerId?: string;

  @IsUUID()
  @IsOptional()
  memberId?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @MinLength(2, { message: 'Search term must be at least 2 characters long' })
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  sortBy?: string = 'collectionDate';

  @IsEnum(['ASC', 'DESC'])
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
