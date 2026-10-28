import { IsString, IsOptional, IsDateString, IsUUID } from 'class-validator';

export class CreateMemberDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  middleName: string;

  @IsString()
  contactNumber: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsUUID()
  centerId?: string;
}
