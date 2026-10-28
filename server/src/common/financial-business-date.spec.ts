import { getFinancialBusinessDate } from './financial-business-date';

describe('getFinancialBusinessDate', () => {
  it('uses the Asia/Manila calendar date across the UTC day boundary', () => {
    expect(getFinancialBusinessDate(new Date('2026-09-03T16:30:00.000Z'))).toBe(
      '2026-09-04',
    );
  });

  it('keeps the earlier Manila date before the boundary', () => {
    expect(getFinancialBusinessDate(new Date('2026-09-03T15:59:59.999Z'))).toBe(
      '2026-09-03',
    );
  });
});
