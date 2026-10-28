import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Loan } from '../../loans/loan.entity';
import { Savings } from '../../savings/savings.entity';
import { Center } from '../../centers/entities/center.entity';

@Entity()
export class Member {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  middleName: string;

  @Column()
  contactNumber: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  birthDate: Date;

  @OneToMany(() => Loan, (loan) => loan.borrower)
  loans: Loan[];

  @OneToMany(() => Savings, (savings) => savings.borrower)
  savings: Savings[];

  @ManyToOne(() => Center, (center) => center.members, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'centerId' })
  center: Center | null;

  @Column({ name: 'centerId', type: 'uuid', nullable: true })
  centerId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
