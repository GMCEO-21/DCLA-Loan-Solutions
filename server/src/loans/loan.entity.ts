import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Member } from '../members/entities/member.entity';
import { LoanRepaymentSchedule } from '../repayments/entities/loan-repayment-schedule.entity';
import { LoanWaiver } from './entities/loan-waiver.entity';

@Entity()
export class Loan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Member, (borrower) => borrower.loans)
  borrower!: Member;

  @Column('decimal', { precision: 12, scale: 2 })
  principalAmount!: number;

  @Column('int')
  termWeeks!: number;

  @Column('decimal', { precision: 5, scale: 2 })
  interestRate!: number;

  @Column({ default: 'active' })
  status!: 'active' | 'paid' | 'defaulted' | 'netoff' | 'payoff';

  @Column('decimal', { precision: 12, scale: 2 })
  weeklyPaymentAmount!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  amountPaid!: number;

  @Column('decimal', { precision: 12, scale: 2 })
  balance!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  advancePaymentBuffer!: number;

  @Column('decimal', { precision: 12, scale: 2 })
  totalAmount!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  serviceCharge!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  notarialFee!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  savings!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  existingSavings!: number;

  @Column('int', { default: 0 })
  weeksPaid!: number;

  @Column('int', { default: 0 })
  paymentCountDisplayOffset!: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  netCashReleased!: number | null;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  pastDueInterestAccrued: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  pastDueInterestWaived: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  pastDueInterestPaid: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  penaltyAccrued: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  penaltyWaived: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  penaltyPaid: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  overdueChargePolicyVersion: string | null;

  @Column({ type: 'date', nullable: true })
  overdueChargePolicyEffectiveDate: string | null;

  @Column({ nullable: true })
  loanCreatedDate!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => LoanRepaymentSchedule, (schedule) => schedule.loan)
  repaymentSchedule!: LoanRepaymentSchedule[];

  @OneToMany(() => LoanWaiver, (waiver) => waiver.loan)
  waivers!: LoanWaiver[];
}
