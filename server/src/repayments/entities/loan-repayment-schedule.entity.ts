import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Loan } from '../../loans/loan.entity';
import { LoanRepaymentAllocation } from './loan-repayment-allocation.entity';

export enum LoanRepaymentStatus {
  UNPAID = 'unpaid',
  PARTIAL = 'partial',
  PAID = 'paid',
  ADVANCE = 'advance',
}

@Entity('loan_repayment_schedule')
@Index(['loanId', 'weekNumber'], { unique: true })
@Index(['loanId', 'dueDate'])
export class LoanRepaymentSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  loanId: string;

  @ManyToOne(() => Loan, (loan) => loan.repaymentSchedule, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'loanId' })
  loan: Loan;

  @Column({ type: 'uuid', nullable: true })
  memberId: string | null;

  @Column({ type: 'uuid', nullable: true })
  centerId: string | null;

  @Column({ type: 'date' })
  dueDate: string;

  @Column({ type: 'int' })
  weekNumber: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  amountDue: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  principalDue: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  interestDue: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  amountPaid: number;

  @Column({
    type: 'enum',
    enum: LoanRepaymentStatus,
    default: LoanRepaymentStatus.UNPAID,
  })
  status: LoanRepaymentStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  advanceApplied: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(
    () => LoanRepaymentAllocation,
    (allocation) => allocation.schedule,
  )
  allocations: LoanRepaymentAllocation[];
}
