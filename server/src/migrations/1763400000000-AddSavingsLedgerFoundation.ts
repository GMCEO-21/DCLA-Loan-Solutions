import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSavingsLedgerFoundation1763400000000
  implements MigrationInterface
{
  name = 'AddSavingsLedgerFoundation1763400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "savings_event_type_enum" AS ENUM (
        'opening_balance',
        'loan_origination_contribution',
        'reloan_contribution',
        'manual_deposit',
        'manual_withdrawal',
        'repayment_debit',
        'repayment_reversal_credit'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "savings"
        ADD "eventType" "savings_event_type_enum",
        ADD "balanceBefore" numeric(12,2),
        ADD "balanceAfter" numeric(12,2),
        ADD "businessDate" date,
        ADD "referenceType" character varying(64),
        ADD "referenceId" uuid,
        ADD "idempotencyKey" character varying(160),
        ADD "performedById" uuid,
        ADD "reversalOfId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "savings"
        ADD CONSTRAINT "FK_savings_performed_by"
        FOREIGN KEY ("performedById") REFERENCES "user"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "savings"
        ADD CONSTRAINT "FK_savings_reversal_of"
        FOREIGN KEY ("reversalOfId") REFERENCES "savings"("id")
        ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_savings_idempotency_key"
      ON "savings" ("idempotencyKey")
      WHERE "idempotencyKey" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_savings_reversal_of_id"
      ON "savings" ("reversalOfId")
      WHERE "reversalOfId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_savings_reversal_of_id"`);
    await queryRunner.query(`DROP INDEX "UQ_savings_idempotency_key"`);
    await queryRunner.query(
      `ALTER TABLE "savings" DROP CONSTRAINT "FK_savings_reversal_of"`,
    );
    await queryRunner.query(
      `ALTER TABLE "savings" DROP CONSTRAINT "FK_savings_performed_by"`,
    );
    await queryRunner.query(`
      ALTER TABLE "savings"
        DROP COLUMN "reversalOfId",
        DROP COLUMN "performedById",
        DROP COLUMN "idempotencyKey",
        DROP COLUMN "referenceId",
        DROP COLUMN "referenceType",
        DROP COLUMN "businessDate",
        DROP COLUMN "balanceAfter",
        DROP COLUMN "balanceBefore",
        DROP COLUMN "eventType"
    `);
    await queryRunner.query(`DROP TYPE "savings_event_type_enum"`);
  }
}
