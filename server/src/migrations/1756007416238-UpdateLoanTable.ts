import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateLoanTable1756007416238 implements MigrationInterface {
    name = 'UpdateLoanTable1756007416238'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loan" DROP COLUMN IF EXISTS "savingsRequired"`);
        await queryRunner.query(`ALTER TABLE "loan" DROP COLUMN IF EXISTS "savingsPaid"`);
        await queryRunner.query(`ALTER TABLE "loan" DROP COLUMN IF EXISTS "savingsStatus"`);
        await queryRunner.query(`ALTER TABLE "loan" ADD COLUMN IF NOT EXISTS "savings" numeric(12,2) NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loan" DROP COLUMN IF EXISTS "savings"`);
        await queryRunner.query(`ALTER TABLE "loan" ADD COLUMN IF NOT EXISTS "savingsStatus" character varying NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE "loan" ADD COLUMN IF NOT EXISTS "savingsPaid" numeric(12,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "loan" ADD COLUMN IF NOT EXISTS "savingsRequired" numeric(12,2) NOT NULL DEFAULT '0'`);
    }

}
