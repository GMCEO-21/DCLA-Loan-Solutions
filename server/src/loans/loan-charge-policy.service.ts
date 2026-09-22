import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseDateOnly } from '../common/date-only';
import { Loan } from './loan.entity';
import {
  NEW_LOAN_OVERDUE_CHARGE_POLICY_VERSION,
  OVERDUE_CHARGE_POLICY_ACTIVATION_DATE,
  OVERDUE_CHARGE_POLICY_V1,
} from './loan-charge-policy.constants';

export interface LoanChargePolicyEnrollment {
  version: typeof OVERDUE_CHARGE_POLICY_V1;
  effectiveDate: string;
}

@Injectable()
export class LoanChargePolicyService {
  constructor(private readonly config: ConfigService) {}

  resolveEnrollment(releaseDate: string): LoanChargePolicyEnrollment | null {
    const version = this.config
      .get<string>(NEW_LOAN_OVERDUE_CHARGE_POLICY_VERSION)
      ?.trim();
    const activationDate = this.config
      .get<string>(OVERDUE_CHARGE_POLICY_ACTIVATION_DATE)
      ?.trim();

    if (!version || !activationDate) return null;
    if (version !== OVERDUE_CHARGE_POLICY_V1) return null;

    const normalizedReleaseDate = parseDateOnly(releaseDate).value;
    const normalizedActivationDate = parseDateOnly(activationDate).value;
    if (normalizedReleaseDate < normalizedActivationDate) return null;

    return {
      version: OVERDUE_CHARGE_POLICY_V1,
      effectiveDate: normalizedReleaseDate,
    };
  }

  isEligible(loan: Loan, asOfDate?: string): boolean {
    if (
      loan.overdueChargePolicyVersion !== OVERDUE_CHARGE_POLICY_V1 ||
      !loan.overdueChargePolicyEffectiveDate
    ) {
      return false;
    }

    if (!asOfDate) return true;
    return (
      loan.overdueChargePolicyEffectiveDate <= parseDateOnly(asOfDate).value
    );
  }
}
