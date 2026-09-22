import { ConfigService } from '@nestjs/config';
import { Loan } from './loan.entity';
import { LoanChargePolicyService } from './loan-charge-policy.service';

describe('LoanChargePolicyService', () => {
  function createService(values: Record<string, string | undefined>) {
    return new LoanChargePolicyService({
      get: (key: string) => values[key],
    } as ConfigService);
  }

  it('leaves loans unenrolled when deployment activation is disabled', () => {
    const service = createService({});
    expect(service.resolveEnrollment('2026-10-01')).toBeNull();
  });

  it('leaves a backdated pre-activation loan unenrolled', () => {
    const service = createService({
      NEW_LOAN_OVERDUE_CHARGE_POLICY_VERSION: 'DCLA_2026_V1',
      OVERDUE_CHARGE_POLICY_ACTIVATION_DATE: '2026-10-01',
    });
    expect(service.resolveEnrollment('2026-09-30')).toBeNull();
  });

  it('enrolls a loan released on the activation date', () => {
    const service = createService({
      NEW_LOAN_OVERDUE_CHARGE_POLICY_VERSION: 'DCLA_2026_V1',
      OVERDUE_CHARGE_POLICY_ACTIVATION_DATE: '2026-10-01',
    });
    expect(service.resolveEnrollment('2026-10-01')).toEqual({
      version: 'DCLA_2026_V1',
      effectiveDate: '2026-10-01',
    });
  });

  it('rejects legacy and future-effective loans during runtime checks', () => {
    const service = createService({});
    expect(
      service.isEligible({
        overdueChargePolicyVersion: null,
        overdueChargePolicyEffectiveDate: null,
      } as Loan),
    ).toBe(false);
    expect(
      service.isEligible(
        {
          overdueChargePolicyVersion: 'DCLA_2026_V1',
          overdueChargePolicyEffectiveDate: '2026-10-02',
        } as Loan,
        '2026-10-01',
      ),
    ).toBe(false);
  });
});
