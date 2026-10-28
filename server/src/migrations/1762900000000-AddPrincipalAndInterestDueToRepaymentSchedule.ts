import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrincipalAndInterestDueToRepaymentSchedule1762900000000
  implements MigrationInterface
{
  name = 'AddPrincipalAndInterestDueToRepaymentSchedule1762900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan_repayment_schedule" ADD COLUMN IF NOT EXISTS "principalDue" numeric(12,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan_repayment_schedule" ADD COLUMN IF NOT EXISTS "interestDue" numeric(12,2) NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan_repayment_schedule" DROP COLUMN IF EXISTS "interestDue"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan_repayment_schedule" DROP COLUMN IF EXISTS "principalDue"`,
    );
  }
}
