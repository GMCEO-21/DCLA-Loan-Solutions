import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Loan } from '../loans/loan.entity';
import { Member } from '../members/entities/member.entity';
import { Center } from '../centers/entities/center.entity';
import { LoanRepaymentAllocation } from './entities/loan-repayment-allocation.entity';
import { CollectionBatch } from './entities/collection-batch.entity';

export enum RepaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum RepaymentOperationType {
  PAYMENT = 'payment',
  REVERSAL = 'reversal',
}
@Entity()
@Index('IDX_repayment_transactions_approved_created', ['createdAt', 'id'], {
  where: `"status" = 'approved'`,
})
export class Repayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Loan, { onDelete: 'CASCADE' })
  loan: Loan;

  @ManyToOne(() => Member, { onDelete: 'CASCADE' })
  member: Member;

  @ManyToOne(() => Center, { onDelete: 'CASCADE' })
  center: Center;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'date', nullable: true })
  collectionDate: string | null;

  @Column({ type: 'boolean', default: false })
  useSavings: boolean;

  @Column({
    type: 'enum',
    enum: RepaymentStatus,
    default: RepaymentStatus.APPROVED,
  })
  status: RepaymentStatus;

  @Column({
    type: 'enum',
    enum: RepaymentOperationType,
    default: RepaymentOperationType.PAYMENT,
  })
  operationType: RepaymentOperationType;

  @Column({ type: 'uuid', nullable: true })
  relatedRepaymentId: string | null;

  @ManyToOne(() => CollectionBatch, (batch) => batch.repayments, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'batchId' })
  batch: CollectionBatch | null;

  @Column({ type: 'uuid', nullable: true })
  batchId: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

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

  @Column({ type: 'date', nullable: true })
  paymentDate: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(
    () => LoanRepaymentAllocation,
    (allocation) => allocation.repayment,
  )
  allocations: LoanRepaymentAllocation[];
}
