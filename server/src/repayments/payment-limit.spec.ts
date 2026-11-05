import { Repository } from 'typeorm';
import { Loan } from '../loans/loan.entity';
import { LoanChargesService } from '../loans/loan-charges.service';
import { LoanChargePolicyService } from '../loans/loan-charge-policy.service';
import { LoanChargeLedger } from '../loans/entities/loan-charge-ledger.entity';
import { LoanWaiver } from '../loans/entities/loan-waiver.entity';
import { LoanRepaymentSchedule } from './entities/loan-repayment-schedule.entity';
import { Repayment } from './repayment.entity';
import { calculatePaymentLimit } from './payment-limit';

function createPaymentLimitCharges() {
  return new LoanChargesService(
    {} as Repository<Loan>,
    {} as Repository<LoanChargeLedger>,
    {} as Repository<LoanRepaymentSchedule>,
    {} as Repository<LoanWaiver>,
    {
      isEligible: (loan: Loan) => Boolean(loan.overdueChargePolicyVersion),
    } as LoanChargePolicyService,
  );
}

describe('Cashier payment limits', () => {
  const charges = createPaymentLimitCharges();
  const loan = () =>
    ({
      id: 'loan',
      status: 'active',
      balance: 450,
      savings: 500,
      weeklyPaymentAmount: 550,
    }) as Loan;

  it('caps final cash at the balance, not the weekly installment', () => {
    expect(calculatePaymentLimit(loan(), [], charges)).toMatchObject({
      maximumCashAmount: 450,
      weeklyPaymentTarget: 450,
    });
  });

  it('allows advance payments up to the whole outstanding balance', () => {
    expect(
      calculatePaymentLimit({ ...loan(), balance: 6500 }, [], charges)
        .maximumCashAmount,
    ).toBe(6500);
  });

  it('reserves pending cash plus its expected savings without mutating the loan', () => {
    const original = loan();
    const pending = [{ amount: 100, useSavings: true }] as Repayment[];
    expect(calculatePaymentLimit(original, pending, charges)).toMatchObject({
      maximumCashAmount: 0,
      pendingAmount: 450,
      availableSavings: 150,
    });
    expect(original.balance).toBe(450);
    expect(original.savings).toBe(500);
  });

  it('handles partial pending cash, cents, and previously excessive pending entries', () => {
    expect(
      calculatePaymentLimit(
        loan(),
        [{ amount: 100.01 }] as Repayment[],
        charges,
      ).maximumCashAmount,
    ).toBe(349.99);
    expect(
      calculatePaymentLimit(loan(), [{ amount: 1090 }] as Repayment[], charges)
        .maximumCashAmount,
    ).toBe(0);
  });

  it('includes only outstanding enrolled charges, respecting payments and waivers', () => {
    const enrolled = {
      ...loan(),
      overdueChargePolicyVersion: 'DCLA_2026_V1',
      penaltyAccrued: 100,
      penaltyPaid: 20,
      penaltyWaived: 30,
      pastDueInterestAccrued: 50,
      pastDueInterestPaid: 10,
      pastDueInterestWaived: 15,
    } as Loan;
    expect(calculatePaymentLimit(enrolled, [], charges)).toMatchObject({
      chargesOutstanding: 75,
      maximumCashAmount: 525,
    });
    expect(
      calculatePaymentLimit(
        { ...enrolled, overdueChargePolicyVersion: null },
        [],
        charges,
      ).maximumCashAmount,
    ).toBe(450);
  });
});
