import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRealizedRevenueFields1763000000000
  implements MigrationInterface
{
  name = 'AddRealizedRevenueFields1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "repayment" ADD COLUMN IF NOT EXISTS "paymentDate" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan_repayment_allocation" ADD COLUMN IF NOT EXISTS "principalPortion" numeric(12,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan_repayment_allocation" ADD COLUMN IF NOT EXISTS "interestPortion" numeric(12,2) NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan_repayment_allocation" DROP COLUMN IF EXISTS "interestPortion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan_repayment_allocation" DROP COLUMN IF EXISTS "principalPortion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "repayment" DROP COLUMN IF EXISTS "paymentDate"`,
    );
  }
}
