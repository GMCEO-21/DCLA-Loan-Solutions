import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ROLE, type RoleName } from '../../auth/roles.constants';

const ASSIGNABLE_ROLES: RoleName[] = [
  ROLE.Admin,
  ROLE.LoanProcessor,
  ROLE.Cashier,
  ROLE.Manager,
];

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsOptional()
  middleName?: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsIn(ASSIGNABLE_ROLES)
  role: RoleName;
}
