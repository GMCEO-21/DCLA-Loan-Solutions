import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRepaymentOperationFields1762100000000
  implements MigrationInterface
{
  name = 'AddRepaymentOperationFields1762100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'repayment_operation_type_enum'
        ) THEN
          CREATE TYPE "repayment_operation_type_enum" AS ENUM ('payment', 'reversal');
        END IF;
      END$$;
    `);

    await queryRunner.query(
      `ALTER TABLE "repayment" ADD COLUMN IF NOT EXISTS "operationType" "repayment_operation_type_enum" NOT NULL DEFAULT 'payment'`,
    );

    await queryRunner.query(
      `ALTER TABLE "repayment" ADD COLUMN IF NOT EXISTS "relatedRepaymentId" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "repayment" DROP COLUMN "relatedRepaymentId"`,
    );

    await queryRunner.query(
      `ALTER TABLE "repayment" DROP COLUMN "operationType"`,
    );

    await queryRunner.query(`DROP TYPE "repayment_operation_type_enum"`);
  }
}
