import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSavingsHistoryIndexes1763500000000
  implements MigrationInterface
{
  name = 'AddSavingsHistoryIndexes1763500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_savings_ledger_history"
      ON "savings" ("borrowerId", "createdAt", "id")
      WHERE "eventType" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_savings_legacy_history"
      ON "savings" ("borrowerId", "createdAt", "id")
      WHERE "eventType" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_savings_legacy_history"`);
    await queryRunner.query(`DROP INDEX "IDX_savings_ledger_history"`);
  }
}
