import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshTokenHashToUser1761000000000
  implements MigrationInterface
{
  name = 'AddRefreshTokenHashToUser1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "hashedRefreshToken" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "hashedRefreshToken"`,
    );
  }
}
