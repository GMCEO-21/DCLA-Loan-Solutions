import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentCountDisplayOffsetToLoan1763100000000
  implements MigrationInterface
{
  name = 'AddPaymentCountDisplayOffsetToLoan1763100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan" ADD COLUMN IF NOT EXISTS "paymentCountDisplayOffset" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan" DROP COLUMN IF EXISTS "paymentCountDisplayOffset"`,
    );
  }
}
