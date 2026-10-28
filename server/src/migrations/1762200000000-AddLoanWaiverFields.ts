import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLoanWaiverFields1762200000000 implements MigrationInterface {
  name = 'AddLoanWaiverFields1762200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan" ADD COLUMN IF NOT EXISTS "pastDueInterestAccrued" numeric(12,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan" ADD COLUMN IF NOT EXISTS "pastDueInterestWaived" numeric(12,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan" ADD COLUMN IF NOT EXISTS "penaltyAccrued" numeric(12,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan" ADD COLUMN IF NOT EXISTS "penaltyWaived" numeric(12,2) NOT NULL DEFAULT '0'`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "loan_waiver" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "loanId" uuid NOT NULL,
        "pastDueInterestWaived" numeric(12,2) NOT NULL DEFAULT '0',
        "penaltyWaived" numeric(12,2) NOT NULL DEFAULT '0',
        "totalWaived" numeric(12,2) NOT NULL DEFAULT '0',
        "waivedById" uuid,
        "reason" text,
        "beforeBalance" numeric(12,2) NOT NULL,
        "afterBalance" numeric(12,2) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loan_waiver_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_loan_waiver_loan_id" ON "loan_waiver" ("loanId")`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_loan_waiver_loan'
            AND table_schema = 'public'
            AND table_name = 'loan_waiver'
        ) THEN
          ALTER TABLE "loan_waiver" ADD CONSTRAINT "FK_loan_waiver_loan" FOREIGN KEY ("loanId") REFERENCES "loan"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan_waiver" DROP CONSTRAINT "FK_loan_waiver_loan"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_loan_waiver_loan_id"`);
    await queryRunner.query(`DROP TABLE "loan_waiver"`);

    await queryRunner.query(`ALTER TABLE "loan" DROP COLUMN "penaltyWaived"`);
    await queryRunner.query(`ALTER TABLE "loan" DROP COLUMN "penaltyAccrued"`);
    await queryRunner.query(
      `ALTER TABLE "loan" DROP COLUMN "pastDueInterestWaived"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan" DROP COLUMN "pastDueInterestAccrued"`,
    );
  }
}

