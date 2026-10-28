import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Collection } from './entities/collection.entity';
import { CollectionsRepository } from './collections.repository';

describe('CollectionsRepository pagination', () => {
  it('filters before paging and uses an id tie-breaker', async () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'row-1' }], 3]),
    };
    const module = await Test.createTestingModule({
      providers: [
        CollectionsRepository,
        {
          provide: getRepositoryToken(Collection),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
          },
        },
      ],
    }).compile();
    const repository = module.get(CollectionsRepository);

    const result = await repository.findAllWithQuery({
      page: 2,
      limit: 1,
      search: 'alpha',
      sortBy: 'collectionDate',
      sortOrder: 'DESC',
    });

    expect(queryBuilder.andWhere.mock.invocationCallOrder[0]).toBeLessThan(
      queryBuilder.skip.mock.invocationCallOrder[0],
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith(
      'collection.collectionDate',
      'DESC',
    );
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith(
      'collection.id',
      'DESC',
    );
    expect(queryBuilder.skip).toHaveBeenCalledWith(1);
    expect(queryBuilder.take).toHaveBeenCalledWith(1);
    expect(result).toMatchObject({
      page: 2,
      limit: 1,
      total: 3,
      totalPages: 3,
    });
  });
});
