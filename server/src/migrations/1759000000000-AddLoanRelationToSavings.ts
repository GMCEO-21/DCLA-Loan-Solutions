import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLoanRelationToSavings1759000000000
  implements MigrationInterface
{
  name = 'AddLoanRelationToSavings1759000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "savings" ADD COLUMN IF NOT EXISTS "loanId" uuid`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_savings_loan'
            AND table_schema = 'public'
            AND table_name = 'savings'
        ) THEN
          ALTER TABLE "savings"
          ADD CONSTRAINT "FK_savings_loan"
          FOREIGN KEY ("loanId") REFERENCES "loan"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "savings" DROP CONSTRAINT "FK_savings_loan"`,
    );
    await queryRunner.query(`ALTER TABLE "savings" DROP COLUMN "loanId"`);
  }
}
