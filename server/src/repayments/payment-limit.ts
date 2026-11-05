import Decimal from 'decimal.js';
import { money, moneyNumber, decimal } from '../common/money';
import { Loan } from '../loans/loan.entity';
import { LoanChargesService } from '../loans/loan-charges.service';
import { Repayment } from './repayment.entity';

export function calculatePaymentLimit(
  loan: Loan,
  pending: Repayment[],
  charges: Pick<
    LoanChargesService,
    'isEligible' | 'getOutstanding' | 'previewPaymentAllocation'
  >,
) {
  const remaining = { ...loan };
  const eligible = charges.isEligible(loan);
  const chargeOutstanding = eligible
    ? charges.getOutstanding(loan).totalOutstanding
    : 0;
  const totalOutstanding = money(loan.balance).add(chargeOutstanding);
  let reserved = new Decimal(0);
  for (const posting of pending) {
    const allocation = charges.previewPaymentAllocation(
      remaining,
      posting.amount,
      Boolean(posting.useSavings),
    );
    reserved = reserved.add(posting.amount).add(allocation.savingsUsed);
    remaining.balance = moneyNumber(
      Decimal.max(
        0,
        money(remaining.balance).sub(allocation.contractual.amount),
      ),
    );
    remaining.savings = moneyNumber(
      Decimal.max(0, money(remaining.savings).sub(allocation.savingsUsed)),
    );
    remaining.penaltyPaid = moneyNumber(
      decimal(remaining.penaltyPaid).add(allocation.penalty.amount),
    );
    remaining.pastDueInterestPaid = moneyNumber(
      decimal(remaining.pastDueInterestPaid).add(
        allocation.pastDueInterest.amount,
      ),
    );
  }
  const remainingCharges = eligible
    ? charges.getOutstanding(remaining).totalOutstanding
    : 0;
  return {
    loanId: loan.id,
    loanStatus: loan.status,
    balance: moneyNumber(loan.balance),
    chargesOutstanding: moneyNumber(chargeOutstanding),
    pendingAmount: moneyNumber(reserved),
    maximumCashAmount: moneyNumber(
      Decimal.max(0, totalOutstanding.sub(reserved)),
    ),
    weeklyPaymentTarget: moneyNumber(
      Decimal.min(
        money(remaining.weeklyPaymentAmount),
        money(remaining.balance),
      ).add(remainingCharges),
    ),
    availableSavings: moneyNumber(remaining.savings),
  };
}
