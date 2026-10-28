import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FindCentersQueryDto } from '../centers/dto/find-centers-query.dto';
import { FindCollectionsQueryDto } from '../collections/dto/find-collections-query.dto';
import { FindMemberLoansQueryDto } from '../loans/dto/find-member-loans-query.dto';
import { FindMembersQueryDto } from '../members/dto/find-members-query.dto';

describe('operational list pagination limits', () => {
  it.each([
    ['members', FindMembersQueryDto, 100],
    ['centers', FindCentersQueryDto, 100],
    ['collections', FindCollectionsQueryDto, 100],
    ['member loans', FindMemberLoansQueryDto, 50],
  ])('rejects an excessive %s limit', async (_name, Dto, maximum) => {
    const value = plainToInstance(Dto, { limit: maximum + 1 });

    const errors = await validate(value);

    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });
});
