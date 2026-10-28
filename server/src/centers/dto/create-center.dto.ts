import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const COLLECTION_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export class CreateCenterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsIn(COLLECTION_DAYS)
  collectionDay: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  leader?: string;
}
