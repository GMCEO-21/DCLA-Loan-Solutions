import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { ROLE, type RoleName } from '../../auth/roles.constants';

const ASSIGNABLE_ROLES: RoleName[] = [
  ROLE.Admin,
  ROLE.LoanProcessor,
  ROLE.Cashier,
  ROLE.Manager,
];

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  middleName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsIn(ASSIGNABLE_ROLES)
  @IsOptional()
  role?: RoleName;
}
