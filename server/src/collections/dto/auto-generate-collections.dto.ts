import { IsDateString, IsUUID } from 'class-validator';

export class AutoGenerateCollectionsDto {
  @IsUUID()
  centerId: string;

  @IsDateString()
  date: string;
}
