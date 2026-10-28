import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class FindMemberLoansQueryDto {
  @IsOptional()
  @IsIn(['all', 'active', 'paid', 'defaulted', 'netoff', 'payoff'])
  status?: 'all' | 'active' | 'paid' | 'defaulted' | 'netoff' | 'payoff' =
    'all';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit = 10;
}
