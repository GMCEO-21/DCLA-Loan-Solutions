import { QueryRunner } from 'typeorm';
import { AddSavingsLedgerFoundation1763400000000 } from '../migrations/1763400000000-AddSavingsLedgerFoundation';

describe('AddSavingsLedgerFoundation1763400000000', () => {
  function createQueryRunner() {
    const query = jest.fn<Promise<unknown>, [string]>().mockResolvedValue([]);
    return {
      query,
      queryRunner: { query } as unknown as QueryRunner,
    };
  }

  it('adds only nullable metadata, constraints, and required indexes', async () => {
    const { query, queryRunner } = createQueryRunner();

    await new AddSavingsLedgerFoundation1763400000000().up(queryRunner);

    const statements = query.mock.calls.map(([statement]) => statement);
    const sql = statements.join('\n');
    expect(sql).toContain('CREATE TYPE "savings_event_type_enum" AS ENUM');
    expect(sql).toContain('ALTER TABLE "savings"');
    expect(sql).toContain('ADD "balanceBefore" numeric(12,2)');
    expect(sql).toContain('ADD "businessDate" date');
    expect(sql).toContain('ON DELETE SET NULL');
    expect(sql).toContain('ON DELETE RESTRICT');
    expect(sql).toContain('WHERE "idempotencyKey" IS NOT NULL');
    expect(sql).toContain('WHERE "reversalOfId" IS NOT NULL');
    expect(sql).not.toMatch(/^\s*(?:INSERT\s+INTO|UPDATE\s+)/im);
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(statements[1]).not.toContain('DEFAULT');
    expect(statements[1]).not.toContain('NOT NULL');
  });

  it('removes only objects introduced by the migration', async () => {
    const { query, queryRunner } = createQueryRunner();

    await new AddSavingsLedgerFoundation1763400000000().down(queryRunner);

    const sql = query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('DROP INDEX "UQ_savings_reversal_of_id"');
    expect(sql).toContain('DROP CONSTRAINT "FK_savings_performed_by"');
    expect(sql).toContain('DROP COLUMN "eventType"');
    expect(sql).toContain('DROP TYPE "savings_event_type_enum"');
    expect(sql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\b/i);
    expect(sql).not.toMatch(/DROP TABLE/i);
  });
});
