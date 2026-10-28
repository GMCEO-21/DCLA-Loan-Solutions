import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueCollectionPerMemberCenterDate1762300000000
  implements MigrationInterface
{
  name = 'AddUniqueCollectionPerMemberCenterDate1762300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'UQ_collection_member_center_date'
            AND table_schema = 'public'
            AND table_name = 'collection'
        ) THEN
          ALTER TABLE "collection" ADD CONSTRAINT "UQ_collection_member_center_date" UNIQUE ("memberId", "centerId", "collectionDate");
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collection" DROP CONSTRAINT "UQ_collection_member_center_date"`,
    );
  }
}

