import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Repayment } from '../repayment.entity';
import { LoanRepaymentSchedule } from './loan-repayment-schedule.entity';

@Entity('loan_repayment_allocation')
@Index(['repaymentId', 'scheduleId'], { unique: true })
export class LoanRepaymentAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  repaymentId: string;

  @ManyToOne(() => Repayment, (repayment) => repayment.allocations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'repaymentId' })
  repayment: Repayment;

  @Column({ type: 'uuid' })
  scheduleId: string;

  @ManyToOne(
    () => LoanRepaymentSchedule,
    (schedule) => schedule.allocations,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'scheduleId' })
  schedule: LoanRepaymentSchedule;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  amountApplied: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  cashPortion: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  savingsPortion: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  principalPortion: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  interestPortion: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
