import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLoanChargePolicyAndLedger1789344000000
  implements MigrationInterface
{
  name = 'AddLoanChargePolicyAndLedger1789344000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan" ADD COLUMN "pastDueInterestPaid" numeric(12,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan" ADD COLUMN "penaltyPaid" numeric(12,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan" ADD COLUMN "overdueChargePolicyVersion" varchar(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan" ADD COLUMN "overdueChargePolicyEffectiveDate" date`,
    );
    await queryRunner.query(`
      ALTER TABLE "loan"
      ADD CONSTRAINT "CHK_loan_overdue_charge_policy_pair"
      CHECK (
        ("overdueChargePolicyVersion" IS NULL AND "overdueChargePolicyEffectiveDate" IS NULL)
        OR
        ("overdueChargePolicyVersion" IS NOT NULL AND "overdueChargePolicyEffectiveDate" IS NOT NULL)
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "loan"
      ADD CONSTRAINT "CHK_loan_overdue_charge_policy_version"
      CHECK (
        "overdueChargePolicyVersion" IS NULL
        OR "overdueChargePolicyVersion" = 'DCLA_2026_V1'
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_loan_overdue_charge_policy_status"
      ON "loan" ("overdueChargePolicyVersion", "status", "overdueChargePolicyEffectiveDate")
      WHERE "overdueChargePolicyVersion" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TYPE "loan_charge_ledger_charge_type_enum" AS ENUM (
        'weekly_penalty',
        'maturity_penalty',
        'past_due_interest'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "loan_charge_ledger_event_type_enum" AS ENUM (
        'accrual',
        'payment',
        'payment_reversal'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "loan_charge_ledger" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "loanId" uuid NOT NULL,
        "scheduleId" uuid,
        "policyVersion" varchar(32) NOT NULL,
        "chargeType" "loan_charge_ledger_charge_type_enum" NOT NULL,
        "eventType" "loan_charge_ledger_event_type_enum" NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "cashPortion" numeric(12,2) NOT NULL DEFAULT '0',
        "savingsPortion" numeric(12,2) NOT NULL DEFAULT '0',
        "baseAmount" numeric(12,2) NOT NULL DEFAULT '0',
        "rate" numeric(10,8) NOT NULL DEFAULT '0',
        "periodStart" date,
        "periodEnd" date,
        "sourceRepaymentId" uuid,
        "reversedLedgerEntryId" uuid,
        "idempotencyKey" varchar(255) NOT NULL,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loan_charge_ledger" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_loan_charge_ledger_idempotency" UNIQUE ("idempotencyKey"),
        CONSTRAINT "CHK_loan_charge_ledger_amount_positive" CHECK ("amount" > 0),
        CONSTRAINT "CHK_loan_charge_ledger_base_nonnegative" CHECK ("baseAmount" >= 0),
        CONSTRAINT "CHK_loan_charge_ledger_rate_nonnegative" CHECK ("rate" >= 0),
        CONSTRAINT "CHK_loan_charge_ledger_payment_sources" CHECK (("eventType" = 'accrual' AND "cashPortion" = 0 AND "savingsPortion" = 0) OR ("eventType" <> 'accrual' AND "cashPortion" >= 0 AND "savingsPortion" >= 0 AND "cashPortion" + "savingsPortion" = "amount")),
        CONSTRAINT "CHK_loan_charge_ledger_reversal_reference" CHECK (("eventType" = 'payment_reversal' AND "reversedLedgerEntryId" IS NOT NULL) OR ("eventType" <> 'payment_reversal' AND "reversedLedgerEntryId" IS NULL)),
        CONSTRAINT "CHK_loan_charge_ledger_period_order" CHECK ("periodStart" IS NULL OR "periodEnd" IS NULL OR "periodStart" <= "periodEnd"),
        CONSTRAINT "CHK_loan_charge_ledger_policy" CHECK ("policyVersion" = 'DCLA_2026_V1'),
        CONSTRAINT "FK_loan_charge_ledger_loan" FOREIGN KEY ("loanId") REFERENCES "loan"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_loan_charge_ledger_schedule" FOREIGN KEY ("scheduleId") REFERENCES "loan_repayment_schedule"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_loan_charge_ledger_repayment" FOREIGN KEY ("sourceRepaymentId") REFERENCES "repayment"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_loan_charge_ledger_reversed_entry" FOREIGN KEY ("reversedLedgerEntryId") REFERENCES "loan_charge_ledger"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_loan_charge_ledger_loan_created" ON "loan_charge_ledger" ("loanId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_loan_charge_ledger_loan_type_event" ON "loan_charge_ledger" ("loanId", "chargeType", "eventType")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_loan_charge_ledger_source_repayment" ON "loan_charge_ledger" ("sourceRepaymentId") WHERE "sourceRepaymentId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_loan_charge_ledger_reversed_entry" ON "loan_charge_ledger" ("reversedLedgerEntryId") WHERE "reversedLedgerEntryId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "loan_charge_ledger"`);
    await queryRunner.query(`DROP TYPE "loan_charge_ledger_event_type_enum"`);
    await queryRunner.query(`DROP TYPE "loan_charge_ledger_charge_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "IDX_loan_overdue_charge_policy_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan" DROP CONSTRAINT "CHK_loan_overdue_charge_policy_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan" DROP CONSTRAINT "CHK_loan_overdue_charge_policy_pair"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan" DROP COLUMN "overdueChargePolicyEffectiveDate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan" DROP COLUMN "overdueChargePolicyVersion"`,
    );
    await queryRunner.query(`ALTER TABLE "loan" DROP COLUMN "penaltyPaid"`);
    await queryRunner.query(
      `ALTER TABLE "loan" DROP COLUMN "pastDueInterestPaid"`,
    );
  }
}
