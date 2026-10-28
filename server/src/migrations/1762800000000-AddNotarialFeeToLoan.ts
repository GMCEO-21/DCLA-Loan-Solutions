import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotarialFeeToLoan1762800000000
  implements MigrationInterface
{
  name = 'AddNotarialFeeToLoan1762800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan" ADD COLUMN IF NOT EXISTS "notarialFee" numeric(12,2) NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan" DROP COLUMN IF EXISTS "notarialFee"`,
    );
  }
}
