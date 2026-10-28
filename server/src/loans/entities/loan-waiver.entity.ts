import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Loan } from '../loan.entity';

@Entity()
export class LoanWaiver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  loanId: string;

  @ManyToOne(() => Loan, (loan) => loan.waivers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loanId' })
  loan: Loan;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  pastDueInterestWaived: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  penaltyWaived: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  totalWaived: number;

  @Column({ type: 'uuid', nullable: true })
  waivedById: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column('decimal', { precision: 12, scale: 2 })
  beforeBalance: number;

  @Column('decimal', { precision: 12, scale: 2 })
  afterBalance: number;

  @CreateDateColumn()
  createdAt: Date;
}

