import { QueryRunner } from 'typeorm';
import { AddTransactionHistoryIndex1763600000000 } from '../migrations/1763600000000-AddTransactionHistoryIndex';

describe('AddTransactionHistoryIndex1763600000000', () => {
  function createQueryRunner() {
    const query = jest.fn<Promise<unknown>, [string]>().mockResolvedValue([]);
    return {
      query,
      queryRunner: { query } as unknown as QueryRunner,
    };
  }

  it('adds the approved repayment history ordering index', async () => {
    const { query, queryRunner } = createQueryRunner();

    await new AddTransactionHistoryIndex1763600000000().up(queryRunner);

    const statement = query.mock.calls[0][0];
    expect(statement).toContain(
      '"IDX_repayment_transactions_approved_created"',
    );
    expect(statement).toContain('"createdAt", "id"');
    expect(statement).toContain(`WHERE "status" = 'approved'`);
    expect(statement).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\b/i);
  });

  it('removes only the transaction history index', async () => {
    const { query, queryRunner } = createQueryRunner();

    await new AddTransactionHistoryIndex1763600000000().down(queryRunner);

    expect(query).toHaveBeenCalledWith(
      'DROP INDEX "IDX_repayment_transactions_approved_created"',
    );
  });
});
