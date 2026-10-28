import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRolesAndSeedLowercaseDefaults1761112500000
  implements MigrationInterface
{
  name = 'CreateRolesAndSeedLowercaseDefaults1761112500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_role_name" UNIQUE ("name")
      )
    `);
    await queryRunner.query(`
      DELETE FROM "role"
      WHERE "name" IN ('Loan processor', 'Cashier', 'Manager', 'Admin')
        AND EXISTS (
          SELECT 1
          FROM "role" existing_role
          WHERE existing_role."name" = CASE "role"."name"
            WHEN 'Loan processor' THEN 'loan processor'
            WHEN 'Cashier' THEN 'cashier'
            WHEN 'Manager' THEN 'manager'
            WHEN 'Admin' THEN 'admin'
          END
        )
    `);
    await queryRunner.query(`
      UPDATE "role"
      SET "name" = CASE "name"
        WHEN 'Loan processor' THEN 'loan processor'
        WHEN 'Cashier' THEN 'cashier'
        WHEN 'Manager' THEN 'manager'
        WHEN 'Admin' THEN 'admin'
        ELSE "name"
      END
      WHERE "name" IN ('Loan processor', 'Cashier', 'Manager', 'Admin')
    `);
    await queryRunner.query(`
      INSERT INTO "role" ("name")
      VALUES
        ('loan processor'),
        ('cashier'),
        ('manager'),
        ('admin')
      ON CONFLICT ("name") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role"
      WHERE "name" IN ('loan processor', 'cashier', 'manager', 'admin')
    `);
  }
}
