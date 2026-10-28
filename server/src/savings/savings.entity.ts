import {
  Entity,
  Index,
  JoinColumn,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Member } from '../members/entities/member.entity';
import { Loan } from '../loans/loan.entity';
import { User } from '../users/user.entity';

export enum SavingsEventType {
  OPENING_BALANCE = 'opening_balance',
  LOAN_ORIGINATION_CONTRIBUTION = 'loan_origination_contribution',
  RELOAN_CONTRIBUTION = 'reloan_contribution',
  MANUAL_DEPOSIT = 'manual_deposit',
  MANUAL_WITHDRAWAL = 'manual_withdrawal',
  REPAYMENT_DEBIT = 'repayment_debit',
  REPAYMENT_REVERSAL_CREDIT = 'repayment_reversal_credit',
}

@Entity()
@Index('UQ_savings_idempotency_key', ['idempotencyKey'], {
  unique: true,
  where: '"idempotencyKey" IS NOT NULL',
})
@Index('UQ_savings_reversal_of_id', ['reversalOfId'], {
  unique: true,
  where: '"reversalOfId" IS NOT NULL',
})
@Index('IDX_savings_ledger_history', ['borrowerId', 'createdAt', 'id'], {
  where: '"eventType" IS NOT NULL',
})
@Index('IDX_savings_legacy_history', ['borrowerId', 'createdAt', 'id'], {
  where: '"eventType" IS NULL',
})
export class Savings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  borrowerId: string;

  @ManyToOne(() => Member, (borrower) => borrower.savings)
  @JoinColumn({ name: 'borrowerId' })
  borrower: Member;

  @ManyToOne(() => Loan, { nullable: true, onDelete: 'SET NULL' })
  loan?: Loan | null;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column({ nullable: true })
  remarks: string;

  @Column({
    type: 'enum',
    enum: SavingsEventType,
    enumName: 'savings_event_type_enum',
    nullable: true,
  })
  eventType: SavingsEventType | null;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  balanceBefore: number | null;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  balanceAfter: number | null;

  @Column({ type: 'date', nullable: true })
  businessDate: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  referenceType: string | null;

  @Column({ type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  idempotencyKey: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'performedById',
    foreignKeyConstraintName: 'FK_savings_performed_by',
  })
  performedBy: User | null;

  @Column({ type: 'uuid', nullable: true })
  performedById: string | null;

  @ManyToOne(() => Savings, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'reversalOfId',
    foreignKeyConstraintName: 'FK_savings_reversal_of',
  })
  reversalOf: Savings | null;

  @Column({ type: 'uuid', nullable: true })
  reversalOfId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
