import { getMetadataArgsStorage } from 'typeorm';
import { Savings, SavingsEventType } from './savings.entity';

describe('Savings ledger entity metadata', () => {
  const columns = new Map(
    getMetadataArgsStorage()
      .columns.filter((column) => column.target === Savings)
      .map((column) => [column.propertyName, column.options]),
  );
  const indexes = getMetadataArgsStorage().indices.filter(
    (index) => index.target === Savings,
  );
  const relations = getMetadataArgsStorage().relations.filter(
    (relation) => relation.target === Savings,
  );
  const joinColumns = getMetadataArgsStorage().joinColumns.filter(
    (joinColumn) => joinColumn.target === Savings,
  );

  it('keeps every ledger metadata column nullable and without a default', () => {
    const metadataColumns = [
      'eventType',
      'balanceBefore',
      'balanceAfter',
      'businessDate',
      'referenceType',
      'referenceId',
      'idempotencyKey',
      'performedById',
      'reversalOfId',
    ];

    for (const propertyName of metadataColumns) {
      expect(columns.get(propertyName)).toEqual(
        expect.objectContaining({ nullable: true }),
      );
      expect(columns.get(propertyName)?.default).toBeUndefined();
    }
  });

  it('persists exactly the approved event values', () => {
    expect(Object.values(SavingsEventType)).toEqual([
      'opening_balance',
      'loan_origination_contribution',
      'reloan_contribution',
      'manual_deposit',
      'manual_withdrawal',
      'repayment_debit',
      'repayment_reversal_credit',
    ]);
    expect(columns.get('eventType')).toEqual(
      expect.objectContaining({
        type: 'enum',
        enum: SavingsEventType,
        enumName: 'savings_event_type_enum',
      }),
    );
  });

  it('declares the required partial unique indexes', () => {
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'UQ_savings_idempotency_key',
          columns: ['idempotencyKey'],
          unique: true,
          where: '"idempotencyKey" IS NOT NULL',
        }),
        expect.objectContaining({
          name: 'UQ_savings_reversal_of_id',
          columns: ['reversalOfId'],
          unique: true,
          where: '"reversalOfId" IS NOT NULL',
        }),
      ]),
    );
  });

  it('retains actors and referenced savings through safe FK behavior', () => {
    const performedBy = relations.find(
      (relation) => relation.propertyName === 'performedBy',
    );
    const reversalOf = relations.find(
      (relation) => relation.propertyName === 'reversalOf',
    );

    expect(performedBy?.options.nullable).toBe(true);
    expect(performedBy?.options.onDelete).toBe('SET NULL');
    expect(reversalOf?.options.nullable).toBe(true);
    expect(reversalOf?.options.onDelete).toBe('RESTRICT');
    expect(
      joinColumns.find(
        (joinColumn) => joinColumn.propertyName === 'performedBy',
      )?.name,
    ).toBe('performedById');
    expect(
      joinColumns.find(
        (joinColumn) => joinColumn.propertyName === 'performedBy',
      )?.foreignKeyConstraintName,
    ).toBe('FK_savings_performed_by');
    expect(
      joinColumns.find((joinColumn) => joinColumn.propertyName === 'reversalOf')
        ?.foreignKeyConstraintName,
    ).toBe('FK_savings_reversal_of');
  });
});
