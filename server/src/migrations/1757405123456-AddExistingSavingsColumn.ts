import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExistingSavingsColumn1757405123456
  implements MigrationInterface
{
  name = 'AddExistingSavingsColumn1757405123456';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan" ADD COLUMN IF NOT EXISTS "existingSavings" numeric(12,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `UPDATE "loan" SET "existingSavings" = 0 WHERE "existingSavings" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan" DROP COLUMN IF EXISTS "existingSavings"`,
    );
  }
}
