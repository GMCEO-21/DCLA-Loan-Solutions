import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Collection } from './entities/collection.entity';
import { FindCollectionsQueryDto } from './dto/find-collections-query.dto';

@Injectable()
export class CollectionsRepository {
  constructor(
    @InjectRepository(Collection)
    private readonly repo: Repository<Collection>,
  ) {}

  async findAllWithQuery(query: FindCollectionsQueryDto) {
    const {
      page = 1,
      limit = 10,
      centerId,
      memberId,
      startDate,
      endDate,
      search,
      sortBy = 'collectionDate',
      sortOrder = 'DESC',
    } = query;

    // Build base query
    const queryBuilder = this.repo
      .createQueryBuilder('collection')
      .leftJoinAndSelect('collection.center', 'center')
      .leftJoinAndSelect('collection.member', 'member');

    // Add where conditions
    if (centerId) {
      queryBuilder.andWhere('collection.centerId = :centerId', { centerId });
    }

    if (memberId) {
      queryBuilder.andWhere('collection.memberId = :memberId', { memberId });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere(
        'collection.collectionDate BETWEEN :startDate AND :endDate',
        {
          startDate,
          endDate,
        },
      );
    }

    // Enhanced search functionality - focus on center names primarily
    if (search && search.trim().length > 0) {
      const searchTerm = `%${search.trim()}%`;
      queryBuilder.andWhere(
        '(center.name ILIKE :searchTerm OR member.firstName ILIKE :searchTerm OR member.lastName ILIKE :searchTerm OR collection.notes ILIKE :searchTerm)',
        { searchTerm },
      );
    }

    // Add sorting
    const validSortColumns = [
      'collectionDate',
      'createdAt',
      'updatedAt',
      'amount',
      'paymentReceived',
      'member.firstName',
      'member.lastName',
      'center.name',
    ];

    const sortColumn = validSortColumns.includes(sortBy)
      ? sortBy
      : 'collectionDate';
    queryBuilder.orderBy(
      sortColumn.includes('.') ? sortColumn : `collection.${sortColumn}`,
      sortOrder,
    );
    if (sortColumn !== 'id') {
      queryBuilder.addOrderBy('collection.id', sortOrder);
    }

    // Add pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // Execute query
    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  create(data: Partial<Collection>) {
    return this.repo.create(data);
  }

  save(entity: Collection | Collection[]) {
    return this.repo.save(entity as any);
  }

  findOne(where: FindOptionsWhere<Collection>) {
    return this.repo.findOne({ where, relations: ['center', 'member'] });
  }

  update(id: string, data: Partial<Collection>) {
    return this.repo.update(id, data);
  }

  delete(id: string) {
    return this.repo.delete(id);
  }
}
