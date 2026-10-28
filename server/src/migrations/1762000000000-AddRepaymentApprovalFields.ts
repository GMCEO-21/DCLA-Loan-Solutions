import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRepaymentApprovalFields1762000000000
  implements MigrationInterface
{
  name = 'AddRepaymentApprovalFields1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'repayment_status_enum'
        ) THEN
          CREATE TYPE "repayment_status_enum" AS ENUM ('pending', 'approved', 'rejected');
        END IF;
      END$$;
    `);
    await queryRunner.query(
      `ALTER TABLE "repayment" ADD COLUMN IF NOT EXISTS "collectionDate" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "repayment" ADD COLUMN IF NOT EXISTS "useSavings" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "repayment" ADD COLUMN IF NOT EXISTS "status" "repayment_status_enum" NOT NULL DEFAULT 'approved'`,
    );
    await queryRunner.query(
      `ALTER TABLE "repayment" ADD COLUMN IF NOT EXISTS "createdById" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "repayment" ADD COLUMN IF NOT EXISTS "approvedById" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "repayment" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "repayment" ADD COLUMN IF NOT EXISTS "rejectedById" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "repayment" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "repayment" ADD COLUMN IF NOT EXISTS "rejectedReason" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "repayment" DROP COLUMN "rejectedReason"`);
    await queryRunner.query(`ALTER TABLE "repayment" DROP COLUMN "rejectedAt"`);
    await queryRunner.query(`ALTER TABLE "repayment" DROP COLUMN "rejectedById"`);
    await queryRunner.query(`ALTER TABLE "repayment" DROP COLUMN "approvedAt"`);
    await queryRunner.query(`ALTER TABLE "repayment" DROP COLUMN "approvedById"`);
    await queryRunner.query(`ALTER TABLE "repayment" DROP COLUMN "createdById"`);
    await queryRunner.query(`ALTER TABLE "repayment" DROP COLUMN "status"`);
    await queryRunner.query(`ALTER TABLE "repayment" DROP COLUMN "useSavings"`);
    await queryRunner.query(`ALTER TABLE "repayment" DROP COLUMN "collectionDate"`);
    await queryRunner.query(`DROP TYPE "repayment_status_enum"`);
  }
}
