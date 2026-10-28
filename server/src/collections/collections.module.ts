import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionsService } from './collections.service';
import { CollectionsController } from './collections.controller';
import { Collection } from './entities/collection.entity';
import { Center } from '../centers/entities/center.entity';
import { Member } from '../members/entities/member.entity';
import { CollectionsRepository } from './collections.repository';
import { Repayment } from '../repayments/repayment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Collection, Center, Member, Repayment])],
  controllers: [CollectionsController],
  providers: [CollectionsService, CollectionsRepository],
  exports: [TypeOrmModule, CollectionsRepository],
})
export class CollectionsModule {}
