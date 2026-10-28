import { IsDateString, IsUUID } from 'class-validator';

export class ApprovePendingCollectionDto {
  @IsUUID()
  centerId: string;

  @IsDateString()
  collectionDate: string;
}
