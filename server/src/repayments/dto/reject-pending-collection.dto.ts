import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RejectPendingCollectionDto {
  @IsUUID()
  centerId: string;

  @IsDateString()
  collectionDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
