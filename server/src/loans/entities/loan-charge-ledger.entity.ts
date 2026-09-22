import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Loan } from '../loan.entity';
import { Repayment } from '../../repayments/repayment.entity';
import { LoanRepaymentSchedule } from '../../repayments/entities/loan-repayment-schedule.entity';

export enum LoanChargeType {
  WEEKLY_PENALTY = 'weekly_penalty',
  MATURITY_PENALTY = 'maturity_penalty',
  PAST_DUE_INTEREST = 'past_due_interest',
}

export enum LoanChargeLedgerEventType {
  ACCRUAL = 'accrual',
  PAYMENT = 'payment',
  PAYMENT_REVERSAL = 'payment_reversal',
}

@Entity('loan_charge_ledger')
@Index('IDX_loan_charge_ledger_loan_created', ['loanId', 'createdAt'])
@Index('IDX_loan_charge_ledger_loan_type_event', [
  'loanId',
  'chargeType',
  'eventType',
])
@Index('IDX_loan_charge_ledger_source_repayment', ['sourceRepaymentId'])
@Index('UQ_loan_charge_ledger_reversed_entry', ['reversedLedgerEntryId'], {
  unique: true,
  where: '"reversedLedgerEntryId" IS NOT NULL',
})
@Index('UQ_loan_charge_ledger_idempotency', ['idempotencyKey'], {
  unique: true,
})
@Check('CHK_loan_charge_ledger_amount_positive', '"amount" > 0')
@Check('CHK_loan_charge_ledger_base_nonnegative', '"baseAmount" >= 0')
@Check('CHK_loan_charge_ledger_rate_nonnegative', '"rate" >= 0')
@Check(
  'CHK_loan_charge_ledger_payment_sources',
  '("eventType" = \'accrual\' AND "cashPortion" = 0 AND "savingsPortion" = 0) OR ("eventType" <> \'accrual\' AND "cashPortion" >= 0 AND "savingsPortion" >= 0 AND "cashPortion" + "savingsPortion" = "amount")',
)
@Check(
  'CHK_loan_charge_ledger_reversal_reference',
  '("eventType" = \'payment_reversal\' AND "reversedLedgerEntryId" IS NOT NULL) OR ("eventType" <> \'payment_reversal\' AND "reversedLedgerEntryId" IS NULL)',
)
@Check(
  'CHK_loan_charge_ledger_period_order',
  '"periodStart" IS NULL OR "periodEnd" IS NULL OR "periodStart" <= "periodEnd"',
)
export class LoanChargeLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  loanId: string;

  @ManyToOne(() => Loan, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'loanId' })
  loan: Loan;

  @Column({ type: 'uuid', nullable: true })
  scheduleId: string | null;

  @ManyToOne(() => LoanRepaymentSchedule, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'scheduleId' })
  schedule: LoanRepaymentSchedule | null;

  @Column({ type: 'varchar', length: 32 })
  policyVersion: string;

  @Column({ type: 'enum', enum: LoanChargeType })
  chargeType: LoanChargeType;

  @Column({ type: 'enum', enum: LoanChargeLedgerEventType })
  eventType: LoanChargeLedgerEventType;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  cashPortion: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  savingsPortion: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  baseAmount: string;

  @Column({ type: 'numeric', precision: 10, scale: 8, default: 0 })
  rate: string;

  @Column({ type: 'date', nullable: true })
  periodStart: string | null;

  @Column({ type: 'date', nullable: true })
  periodEnd: string | null;

  @Column({ type: 'uuid', nullable: true })
  sourceRepaymentId: string | null;

  @ManyToOne(() => Repayment, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sourceRepaymentId' })
  sourceRepayment: Repayment | null;

  @Column({ type: 'uuid', nullable: true })
  reversedLedgerEntryId: string | null;

  @ManyToOne(() => LoanChargeLedger, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'reversedLedgerEntryId' })
  reversedLedgerEntry: LoanChargeLedger | null;

  @Column({ type: 'varchar', length: 255 })
  idempotencyKey: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
