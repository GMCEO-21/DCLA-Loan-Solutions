# DCLA-06 Manual QA Checklist

> **QA date baseline:** The dates below are aligned to a manual sweep run on
> October 7, 2026 (Manila business date). If testing on a different date,
> recalculate the release dates, Friday cutoffs, maturity date, and overdue-day
> count before creating the QA loans.

## 2. Verify Legacy Isolation

1. Log in as an admin.
2. Open **Members**.
3. Select an existing member with an old loan.
4. Open the loan and view its history.

### Acceptance Criteria

- Charge policy displays **Legacy / Not Applicable**.
- Existing balance, amount paid, and savings are unchanged.
- No automated charge history exists.
- Running DCLA-06 must never enroll this existing loan.

## 3. Create the QA Center

1. Open **Centers**.
2. Click **Add Center**.
3. Enter the following:
   - **Center Name:** `DCLA06 QA CENTER`
   - **Collection Day:** `Sunday`
   - **Leader:** `QA Tester`
4. Click **Create Center**.

### Acceptance Criteria

- The center is created successfully.
- The collection day displays **Sunday**.

## 4. Create Weekly Penalty Loans

Create a separate QA member for each case because a member can only have one
active loan.

For every loan:

1. Open **Members** and click **Add Member**.
2. Assign the member to `DCLA06 QA CENTER`.
3. Open the new member.
4. Click **Create New Loan**.
5. Enable **Set custom loan creation date**.
6. Set the date to `2026-09-21`.
7. Set the term to `8 weeks`.
8. Use zero service charge, notarial fee, and savings unless the application
   requires otherwise.

Create the following cases:

| Member | Principal | Expected Weekly Amount | Expected Penalty |
| --- | ---: | ---: | ---: |
| QA PENALTY 50 | PHP 6,000 | PHP 900 | PHP 50 |
| QA PENALTY 100 | PHP 8,000 | PHP 1,200 | PHP 100 |
| QA PENALTY 200 | PHP 14,000 | PHP 2,100 | PHP 200 |
| QA FULL PAYMENT | PHP 6,000 | PHP 900 | PHP 0 |
| QA PARTIAL PAYMENT | PHP 6,000 | PHP 900 | PHP 50 |

### Acceptance Criteria

- Every new loan displays policy `DCLA_2026_V1`.
- The effective date displays `2026-09-21`.
- The first scheduled due date is `2026-09-27`.
- Old loans remain legacy loans.

## 5. Record Full and Partial Payments

Complete these payments before running the manual sweep.

### Full Payment

1. Open **Collections**.
2. Select **Collections by Date**.
3. Choose `2026-09-27`.
4. Open `DCLA06 QA CENTER`.
5. Find `QA FULL PAYMENT`.
6. Click **Payment**.
7. Enter `900`.
8. Click **Process Payment**.

Expected result: the installment is fully paid before the Friday cutoff.

### Partial Payment

1. In the same collection, find `QA PARTIAL PAYMENT`.
2. Click **Payment**.
3. Enter `20`.
4. Click **Process Payment**.

Because admin payments are auto-approved, charge computation runs immediately.

### Acceptance Criteria

For `QA FULL PAYMENT`:

- No weekly penalty accrues.
- Contractual amount paid increases by PHP 900.

For `QA PARTIAL PAYMENT`:

- A PHP 50 penalty accrues.
- PHP 20 is applied to the penalty first.
- The outstanding penalty becomes PHP 30.
- Contractual `amountPaid` remains PHP 0.
- The partial payment does not prevent the weekly penalty.

## 6. Run the Manual Sweep

1. Open **Waivers**.
2. Click **Run Charge Sweep**.
3. Wait for the completion message.
4. Click **Refresh Data**.

### Acceptance Criteria

- The sweep reports zero failures.
- `QA PENALTY 50` receives a PHP 50 penalty.
- `QA PENALTY 100` receives a PHP 100 penalty.
- `QA PENALTY 200` receives a PHP 200 penalty.
- `QA PARTIAL PAYMENT` retains PHP 30 outstanding after its PHP 20 payment.
- `QA FULL PAYMENT` receives no weekly penalty.

Run **Run Charge Sweep** again.

### Idempotency Acceptance Criteria

- The second sweep creates zero new events for the same periods.
- No totals increase.
- No duplicate weekly penalties appear.

## 7. Inspect the Charge Ledger

For each QA member:

1. Open **Members**.
2. Open the member's loan.
3. Open the loan history.
4. Review the charge summary and history.

### Acceptance Criteria

- The policy displays `DCLA_2026_V1`.
- Weekly accrual rows contain the correct amounts.
- Partial-payment history contains both accrual and payment rows.
- Contractual balance excludes charge payments.
- **Ledger reconciliation: Matched** is displayed.

## 8. Test Maturity Charges

Create another QA member and loan with these values:

| Field | Value |
| --- | --- |
| Member | `QA MATURITY` |
| Center | `DCLA06 QA CENTER` |
| Principal | PHP 4,000 |
| Term | 4 weeks |
| Loan creation date | `2026-08-17` |

With a Sunday collection day, the expected due dates are:

- `2026-08-23`
- `2026-08-30`
- `2026-09-06`
- `2026-09-13`

Leave the loan completely unpaid, then run the manual sweep.

### Expected Amounts as of October 7, 2026

- Weekly penalties before maturity: 3 x PHP 100 = PHP 300.
- Maturity penalty: PHP 4,000 x 30% = PHP 1,200.
- Daily PDI: PHP 4,000 x 10% / 30 = PHP 13.33.
- Overdue days from September 14 through October 7: 24 days.
- Total PDI: PHP 319.92.
- Total outstanding charges: PHP 1,819.92.

### Acceptance Criteria

- Exactly three weekly penalties exist.
- No weekly penalty exists after maturity.
- Exactly one PHP 1,200 maturity penalty exists.
- Exactly 24 daily PDI entries exist.
- The PDI base is PHP 4,000 and does not include previous interest.
- Re-running the sweep creates no duplicates.
- Reconciliation displays **Matched**.

## 9. Test Payment Priority

Admin payments auto-approve. To test the **Approvals** preview, submit the
payment using a cashier account.

1. Log in as a cashier.
2. Open **Collections** and select **Collections by Date**.
3. Select the applicable QA collection date.
4. Post a PHP 2,000 payment for `QA MATURITY`.
5. Log out.
6. Log in as an admin.
7. Open **Approvals**.
8. Click **Approve**.

### Expected Preview

| Bucket | Amount |
| --- | ---: |
| Penalty | PHP 1,500 |
| Past-due interest | PHP 319.92 |
| Contractual loan | PHP 180.08 |
| **Total** | **PHP 2,000** |

Approve the collection.

### Acceptance Criteria

- The preview follows the penalty -> PDI -> contractual allocation order.
- Outstanding penalty becomes zero.
- Outstanding PDI becomes zero.
- Contractual `amountPaid` increases only by PHP 180.08.
- Loan balance becomes PHP 4,219.92.
- Charge payments do not inflate contractual payment totals.
- Ledger reconciliation remains **Matched**.

## 10. Test a Waiver

Use a separate matured QA loan that still has outstanding charges.

1. Open **Waivers**.
2. Find the QA loan.
3. Click **Apply Waiver**.
4. Enter a partial penalty or PDI waiver.
5. Add a reason such as `DCLA-06 QA`.
6. Submit the waiver.
7. Open **History**.

### Acceptance Criteria

- A waiver cannot exceed the outstanding amount.
- Outstanding charges decrease by the exact waiver amount.
- Contractual balance remains unchanged.
- Waiver history records the amount, reason, actor, and timestamp.
- A full waiver removes the loan from the waiver-candidate list.
- Only an admin or manager can perform a waiver.

## 11. Test a Reversal

1. Open **Transactions**.
2. Locate the PHP 2,000 QA payment.
3. Request or execute its reversal.
4. Reopen the loan history.

### Acceptance Criteria

- Penalty and PDI payments are reopened exactly.
- The PHP 180.08 contractual payment is reversed.
- Loan balance returns to PHP 4,400.
- Append-only `payment_reversal` charge rows appear.
- A duplicate reversal is rejected.
- Reconciliation remains **Matched**.

## Final Acceptance

DCLA-06 passes QA when all of the following are true:

- Legacy loans remain completely unaffected.
- Only loans released on or after activation are enrolled.
- Weekly tiers, Friday cutoff, partial/full payment behavior, maturity penalty,
  and daily PDI match the expected values.
- Sweeps are idempotent.
- Payments, savings, reversals, and waivers reconcile.
- The scheduler remains disabled during QA.
- No sweep reports failures.
