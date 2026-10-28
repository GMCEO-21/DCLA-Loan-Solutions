import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceUserRoleColumnWithRoleRelation1761115000000
  implements MigrationInterface
{
  name = 'ReplaceUserRoleColumnWithRoleRelation1761115000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasUserTable = await queryRunner.hasTable('user');
    const hasRoleTable = await queryRunner.hasTable('role');
    if (!hasUserTable || !hasRoleTable) {
      return;
    }

    const hasRoleIdColumn = await queryRunner.hasColumn('user', 'roleId');
    if (!hasRoleIdColumn) {
      await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "roleId" uuid`);
    }

    const hasLegacyRoleColumn = await queryRunner.hasColumn('user', 'role');
    if (hasLegacyRoleColumn) {
      await queryRunner.query(`
        INSERT INTO "role" ("name")
        SELECT DISTINCT lower(trim("role"))
        FROM "user"
        WHERE "role" IS NOT NULL
          AND trim("role") <> ''
        ON CONFLICT ("name") DO NOTHING
      `);

      await queryRunner.query(`
        UPDATE "user" u
        SET "roleId" = r."id"
        FROM "role" r
        WHERE u."roleId" IS NULL
          AND u."role" IS NOT NULL
          AND trim(u."role") <> ''
          AND lower(trim(u."role")) = r."name"
      `);
    }

    const unmappedUsers = await queryRunner.query(`
      SELECT COUNT(*)::int AS "count"
      FROM "user"
      WHERE "roleId" IS NULL
    `);
    const remaining = Number(unmappedUsers?.[0]?.count ?? 0);
    if (remaining > 0) {
      throw new Error(
        `Cannot replace legacy user role column: ${remaining} user records could not be mapped to a roleId.`,
      );
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_user_roleId_role'
            AND table_schema = 'public'
            AND table_name = 'user'
        ) THEN
          ALTER TABLE "user"
          ADD CONSTRAINT "FK_user_roleId_role"
          FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE "user"
      ALTER COLUMN "roleId" SET NOT NULL
    `);

    if (hasLegacyRoleColumn) {
      await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "role"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasUserTable = await queryRunner.hasTable('user');
    if (!hasUserTable) {
      return;
    }

    const hasLegacyRoleColumn = await queryRunner.hasColumn('user', 'role');
    if (!hasLegacyRoleColumn) {
      await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "role" character varying`);
    }

    const hasRoleIdColumn = await queryRunner.hasColumn('user', 'roleId');
    if (hasRoleIdColumn) {
      await queryRunner.query(`
        UPDATE "user" u
        SET "role" = r."name"
        FROM "role" r
        WHERE u."roleId" = r."id"
      `);

      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.table_constraints
            WHERE constraint_name = 'FK_user_roleId_role'
              AND table_schema = 'public'
              AND table_name = 'user'
          ) THEN
            ALTER TABLE "user" DROP CONSTRAINT "FK_user_roleId_role";
          END IF;
        END$$;
      `);

      await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "roleId" DROP NOT NULL`);
      await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "roleId"`);
    }
  }
}
