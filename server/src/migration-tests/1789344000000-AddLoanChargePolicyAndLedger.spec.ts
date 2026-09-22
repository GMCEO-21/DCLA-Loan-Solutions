import { QueryRunner } from 'typeorm';
import { AddLoanChargePolicyAndLedger1789344000000 } from '../migrations/1789344000000-AddLoanChargePolicyAndLedger';

describe('AddLoanChargePolicyAndLedger1789344000000', () => {
  function createQueryRunner() {
    const query = jest.fn<Promise<unknown>, [string]>().mockResolvedValue([]);
    return {
      query,
      queryRunner: { query } as unknown as QueryRunner,
    };
  }

  it('adds nullable policy enrollment without defaults or backfill', async () => {
    const { query, queryRunner } = createQueryRunner();
    await new AddLoanChargePolicyAndLedger1789344000000().up(queryRunner);

    const statements = query.mock.calls.map(([statement]) => statement);
    const sql = statements.join('\n');
    const policyStatements = statements.filter((statement) =>
      statement.includes('overdueChargePolicy'),
    );

    expect(sql).toContain('CREATE TABLE "loan_charge_ledger"');
    expect(sql).toContain('UNIQUE ("idempotencyKey")');
    expect(sql).toContain('UQ_loan_charge_ledger_reversed_entry');
    expect(sql).toContain('CHK_loan_charge_ledger_payment_sources');
    expect(sql).toContain('ON DELETE RESTRICT');
    expect(sql).toContain('CHK_loan_overdue_charge_policy_pair');
    expect(sql).not.toMatch(/^\s*(?:INSERT\s+INTO|UPDATE\s+)/im);
    expect(policyStatements[0]).not.toContain('DEFAULT');
    expect(policyStatements[0]).not.toContain('NOT NULL');
    expect(policyStatements[1]).not.toContain('DEFAULT');
    expect(policyStatements[1]).not.toContain('NOT NULL');
  });
});
