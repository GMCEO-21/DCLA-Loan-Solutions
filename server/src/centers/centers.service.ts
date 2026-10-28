import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Center } from './entities/center.entity';
import { CreateCenterDto } from './dto/create-center.dto';
import { UpdateCenterDto } from './dto/update-center.dto';
import { FindCentersQueryDto } from './dto/find-centers-query.dto';
import { Member } from '../members/entities/member.entity';

@Injectable()
export class CentersService {
  constructor(
    @InjectRepository(Center)
    private readonly centerRepository: Repository<Center>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
  ) {}

  async create(createCenterDto: CreateCenterDto): Promise<Center> {
    const center = this.centerRepository.create(createCenterDto);
    return this.centerRepository.save(center);
  }

  async findAll(query?: FindCentersQueryDto): Promise<
    | Center[]
    | {
        items: Center[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }
  > {
    if (!query) {
      return this.centerRepository.find();
    }

    const { page = 1, limit = 10, search } = query;

    const qb = this.centerRepository.createQueryBuilder('center');

    if (search && search.trim().length > 0) {
      const term = `%${search.trim().toLowerCase()}%`;
      qb.where(
        'LOWER(center.name) LIKE :term OR LOWER(center.address) LIKE :term',
        {
          term,
        },
      );
    }

    qb.orderBy('center.name', 'ASC')
      .addOrderBy('center.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string): Promise<Center> {
    const center = await this.centerRepository.findOne({ where: { id } });
    if (!center) throw new NotFoundException(`Center #${id} not found`);
    return center;
  }

  findOptions(): Promise<Center[]> {
    return this.centerRepository.find({
      select: ['id', 'name', 'collectionDay', 'address', 'leader'],
      order: { name: 'ASC' },
    });
  }

  async update(id: string, updateCenterDto: UpdateCenterDto): Promise<Center> {
    const center = await this.centerRepository.preload({
      id,
      ...updateCenterDto,
    });
    if (!center) throw new NotFoundException(`Center #${id} not found`);
    return this.centerRepository.save(center);
  }

  async remove(id: string): Promise<void> {
    // Prevent deleting a center that still has members
    const memberCount = await this.memberRepository.count({
      where: { center: { id } },
    });
    if (memberCount > 0) {
      throw new BadRequestException(
        `Cannot delete center while ${memberCount} member(s) are assigned. Reassign or remove members first.`,
      );
    }

    const result = await this.centerRepository.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Center #${id} not found`);
  }
}
