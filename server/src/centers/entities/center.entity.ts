import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Collection } from '../../collections/entities/collection.entity';
import { Member } from '../../members/entities/member.entity';

@Entity()
export class Center {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  collectionDay: string;

  @OneToMany(() => Collection, (collection) => collection.center)
  collections: Collection[];

  @OneToMany(() => Member, (member) => member.center)
  members: Member[];

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  leader: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
