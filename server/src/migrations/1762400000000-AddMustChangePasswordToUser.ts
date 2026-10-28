import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMustChangePasswordToUser1762400000000
  implements MigrationInterface
{
  name = 'AddMustChangePasswordToUser1762400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "mustChangePassword" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "mustChangePassword"`);
  }
}

