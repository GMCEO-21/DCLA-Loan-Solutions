import { MigrationInterface, QueryRunner } from 'typeorm';

export class SplitAdminAndSuperAdminRoles1763200000000
  implements MigrationInterface
{
  name = 'SplitAdminAndSuperAdminRoles1763200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role" ("name")
      VALUES ('superadmin'), ('admin')
      ON CONFLICT ("name") DO NOTHING
    `);

    // Preserve current admin accounts as the user-management-only superadmin.
    await queryRunner.query(`
      UPDATE "user" u
      SET "roleId" = superadmin_role."id"
      FROM "role" current_admin, "role" superadmin_role
      WHERE u."roleId" = current_admin."id"
        AND current_admin."name" = 'admin'
        AND superadmin_role."name" = 'superadmin'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const operationalAdmins = await queryRunner.query(`
      SELECT COUNT(*)::int AS "count"
      FROM "user" u
      INNER JOIN "role" r ON r."id" = u."roleId"
      WHERE r."name" = 'admin'
    `);

    if (Number(operationalAdmins?.[0]?.count ?? 0) > 0) {
      throw new Error(
        'Cannot revert while operational admin accounts exist; role separation would be lost.',
      );
    }

    await queryRunner.query(`
      UPDATE "user" u
      SET "roleId" = admin_role."id"
      FROM "role" superadmin_role, "role" admin_role
      WHERE u."roleId" = superadmin_role."id"
        AND superadmin_role."name" = 'superadmin'
        AND admin_role."name" = 'admin'
    `);

    await queryRunner.query(`DELETE FROM "role" WHERE "name" = 'superadmin'`);
  }
}
