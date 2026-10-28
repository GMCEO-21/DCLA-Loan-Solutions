import { Test, TestingModule } from '@nestjs/testing';
import { CentersService } from './centers.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Center } from './entities/center.entity';
import { Member } from '../members/entities/member.entity';

describe('CentersService', () => {
  let service: CentersService;
  let centerRepository: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    centerRepository = { createQueryBuilder: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CentersService,
        { provide: getRepositoryToken(Center), useValue: centerRepository },
        { provide: getRepositoryToken(Member), useValue: {} },
      ],
    }).compile();

    service = module.get<CentersService>(CentersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('filters before paging and uses the center id as a stable tie-breaker', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    centerRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    await service.findAll({ page: 2, limit: 10, search: 'alpha' });

    expect(queryBuilder.where.mock.invocationCallOrder[0]).toBeLessThan(
      queryBuilder.skip.mock.invocationCallOrder[0],
    );
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('center.id', 'ASC');
    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
    expect(queryBuilder.take).toHaveBeenCalledWith(10);
  });
});
