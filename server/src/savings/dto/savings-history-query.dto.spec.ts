import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  SavingsHistoryQueryDto,
  SavingsHistoryScope,
} from './savings-history-query.dto';

describe('SavingsHistoryQueryDto', () => {
  async function errors(query: Record<string, unknown>) {
    return validate(plainToInstance(SavingsHistoryQueryDto, query));
  }

  it.each([SavingsHistoryScope.LEDGER, SavingsHistoryScope.LEGACY])(
    'accepts %s scope and applies pagination defaults',
    async (scope) => {
      const dto = plainToInstance(SavingsHistoryQueryDto, { scope });

      await expect(validate(dto)).resolves.toHaveLength(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(25);
    },
  );

  it.each([
    [{ scope: 'all' }, 'scope'],
    [{ scope: SavingsHistoryScope.LEDGER, page: 0 }, 'page'],
    [{ scope: SavingsHistoryScope.LEDGER, page: -1 }, 'page'],
    [{ scope: SavingsHistoryScope.LEDGER, limit: 0 }, 'limit'],
    [{ scope: SavingsHistoryScope.LEDGER, limit: 101 }, 'limit'],
  ])('rejects invalid query %#', async (query, property) => {
    const validationErrors = await errors(query);

    expect(validationErrors.map((error) => error.property)).toContain(property);
  });

  it('transforms valid string pagination values', async () => {
    const dto = plainToInstance(SavingsHistoryQueryDto, {
      scope: SavingsHistoryScope.LEGACY,
      page: '2',
      limit: '100',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({ page: 2, limit: 100 });
  });
});
