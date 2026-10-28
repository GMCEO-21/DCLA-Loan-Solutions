import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransactionHistoryIndex1763600000000
  implements MigrationInterface
{
  name = 'AddTransactionHistoryIndex1763600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_repayment_transactions_approved_created"
      ON "repayment" ("createdAt", "id")
      WHERE "status" = 'approved'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_repayment_transactions_approved_created"`,
    );
  }
}
