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
import { Loan } from '../../loans/loan.entity';
import { Member } from '../../members/entities/member.entity';
import { Repayment } from '../../repayments/repayment.entity';
import { User } from '../../users/user.entity';

export enum SmsNotificationEventType {
  LOAN_CREATED = 'loan_created',
  REPAYMENT_POSTED = 'repayment_posted',
}

export enum SmsNotificationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SENT = 'sent',
  FAILED = 'failed',
}

@Entity('sms_notification')
@Index('UQ_sms_notification_idempotency_key', ['idempotencyKey'], {
  unique: true,
})
@Index('IDX_sms_notification_worker', ['status', 'nextAttemptAt', 'createdAt'])
export class SmsNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: SmsNotificationEventType,
    enumName: 'sms_notification_event_type_enum',
  })
  eventType: SmsNotificationEventType;

  @ManyToOne(() => Member, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'memberId' })
  member: Member | null;

  @Column({ type: 'uuid', nullable: true })
  memberId: string | null;

  @ManyToOne(() => Loan, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'loanId' })
  loan: Loan | null;

  @Column({ type: 'uuid', nullable: true })
  loanId: string | null;

  @ManyToOne(() => Repayment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'repaymentId' })
  repayment: Repayment | null;

  @Column({ type: 'uuid', nullable: true })
  repaymentId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'requestedById' })
  requestedBy: User | null;

  @Column({ type: 'uuid', nullable: true })
  requestedById: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  recipient: string | null;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'enum',
    enum: SmsNotificationStatus,
    enumName: 'sms_notification_status_enum',
    default: SmsNotificationStatus.PENDING,
  })
  status: SmsNotificationStatus;

  @Column({ type: 'varchar', length: 32, default: 'unisms' })
  provider: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  providerMessageId: string | null;

  @Column({ type: 'varchar', length: 160 })
  idempotencyKey: string;

  @Column({ type: 'int', default: 0 })
  attemptCount: number;

  @Column({ type: 'varchar', length: 80, nullable: true })
  lastErrorCode: string | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamp', nullable: true })
  nextAttemptAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
