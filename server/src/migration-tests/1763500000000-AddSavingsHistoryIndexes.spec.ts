import { QueryRunner } from 'typeorm';
import { AddSavingsHistoryIndexes1763500000000 } from '../migrations/1763500000000-AddSavingsHistoryIndexes';

describe('AddSavingsHistoryIndexes1763500000000', () => {
  function createQueryRunner() {
    const query = jest.fn<Promise<unknown>, [string]>().mockResolvedValue([]);
    return {
      query,
      queryRunner: { query } as unknown as QueryRunner,
    };
  }

  it('adds separate deterministic indexes for ledger and legacy history', async () => {
    const { query, queryRunner } = createQueryRunner();

    await new AddSavingsHistoryIndexes1763500000000().up(queryRunner);

    const statements = query.mock.calls.map(([statement]) => statement);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('"IDX_savings_ledger_history"');
    expect(statements[0]).toContain('"borrowerId", "createdAt", "id"');
    expect(statements[0]).toContain('WHERE "eventType" IS NOT NULL');
    expect(statements[1]).toContain('"IDX_savings_legacy_history"');
    expect(statements[1]).toContain('WHERE "eventType" IS NULL');
    expect(statements.join('\n')).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\b/i);
  });

  it('removes only the two history indexes', async () => {
    const { query, queryRunner } = createQueryRunner();

    await new AddSavingsHistoryIndexes1763500000000().down(queryRunner);

    expect(query.mock.calls.map(([statement]) => statement)).toEqual([
      'DROP INDEX "IDX_savings_legacy_history"',
      'DROP INDEX "IDX_savings_ledger_history"',
    ]);
  });
});
