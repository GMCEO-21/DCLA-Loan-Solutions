import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Center } from '../../centers/entities/center.entity';
import { Repayment } from '../repayment.entity';

export enum CollectionBatchStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity()
export class CollectionBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Center, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'centerId' })
  center: Center;

  @Column()
  centerId: string;

  @Column({ type: 'date' })
  collectionDate: string;

  @Column({
    type: 'enum',
    enum: CollectionBatchStatus,
    default: CollectionBatchStatus.PENDING,
  })
  status: CollectionBatchStatus;

  @Column({ type: 'uuid', nullable: true })
  submittedById: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  submittedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  approvedById: string | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  rejectedById: string | null;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectedReason: string | null;

  @OneToMany(() => Repayment, (repayment) => repayment.batch)
  repayments: Repayment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
