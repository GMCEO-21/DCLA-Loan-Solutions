import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServiceChargeToLoan1762700000000
  implements MigrationInterface
{
  name = 'AddServiceChargeToLoan1762700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan" ADD COLUMN IF NOT EXISTS "serviceCharge" numeric(12,2) NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan" DROP COLUMN IF EXISTS "serviceCharge"`,
    );
  }
}
