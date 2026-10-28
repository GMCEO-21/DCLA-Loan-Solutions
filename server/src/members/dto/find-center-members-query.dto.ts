import { IsDateString, IsOptional } from 'class-validator';

export class FindCenterMembersQueryDto {
  @IsDateString()
  @IsOptional()
  date?: string;
}
