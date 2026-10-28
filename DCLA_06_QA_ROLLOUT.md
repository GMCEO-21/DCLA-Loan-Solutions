# DCLA-06 QA and Production Rollout

## Scope

DCLA-06 applies only to loans immutably enrolled with
`overdueChargePolicyVersion = DCLA_2026_V1`. Existing/legacy loans remain `NULL`
and are never automatically charged.

Implemented behavior:

- Full weekly penalty after the Friday cutoff: PHP 50 below PHP 1,000 weekly
  amortization, PHP 100 from PHP 1,000 to below PHP 2,000, and PHP 200 at or
  above PHP 2,000.
- Partial weekly payment still receives the full weekly penalty.
- Weekly penalties stop at maturity.
- Starting the day after final due date: one-time 30% maturity penalty on
  remaining scheduled principal.
- Daily simple PDI: remaining scheduled principal x 10% / 30, rounded half-up
  to centavos per day. PDI does not compound and decreases after principal is
  paid.
- Payment order: penalty, PDI, contractual loan balance.
- Savings can fund all three buckets when `useSavings` is selected.
- Charge money never increases contractual `loan.amountPaid` or schedule paid
  amounts.
- Exact repayment reversal uses append-only compensating charge-ledger rows.
- Managers can waive all penalty/PDI types. A loan cannot complete or reloan
  until charges are paid or waived.

## Deployment Configuration

Use Node.js `20.19.0` for both applications.

### Phase 1 - Schema and code, feature off

1. Take and verify a production database backup.
2. Deploy migration `1789344000000-AddLoanChargePolicyAndLedger`.
3. Deploy server/client code with:

```env
LOAN_CHARGE_SCHEDULER_ENABLED=false
```

4. Do not define the two enrollment variables yet.
5. Verify existing loan rows have `NULL` policy fields and unchanged balances.
6. Smoke-test legacy loan creation, payment approval, reversal, savings, and
   reloan behavior.

### Phase 2 - Controlled new-loan enrollment

After the client approves the exact effective date, set both variables:

```env
NEW_LOAN_OVERDUE_CHARGE_POLICY_VERSION=DCLA_2026_V1
OVERDUE_CHARGE_POLICY_ACTIVATION_DATE=YYYY-MM-DD
LOAN_CHARGE_SCHEDULER_ENABLED=false
```

Restart the API. A direct loan or reloan is enrolled only when its server-used
release/origination date is on or after the activation date. Do not backdate the
activation to include already released loans.

### Phase 3 - Automated accrual

1. Complete the enrolled-loan QA cases below.
2. As a manager, open **Waivers** and select **Run Charge Sweep**.
3. Verify the reported failure count is zero.
4. Open the test loan history and confirm **Ledger reconciliation: Matched**.
5. Enable the worker:

```env
LOAN_CHARGE_SCHEDULER_ENABLED=true
LOAN_CHARGE_POLL_INTERVAL_MS=3600000
LOAN_CHARGE_BATCH_SIZE=100
```

6. Restart and monitor API logs for sweep counts/failures.

## QA Preconditions

- Use staging or an isolated database copied from a representative schema.
- Use manager, cashier, and loan-processor test accounts.
- Set the activation date before creating eligible test loans.
- Keep at least one pre-activation legacy loan for regression testing.
- Record loan IDs, repayment IDs, expected amounts, and screenshots for each
  case.

## QA Cases

### 1. Eligibility isolation

1. Open a pre-activation loan and its loan history.
2. Confirm policy shows **Legacy / Not Applicable** and no charge action/history.
3. Create a direct loan on/after activation.
4. Confirm policy shows `DCLA_2026_V1` and its effective date.
5. Create a reloan on/after activation and confirm it is also enrolled.
6. Run a sweep and confirm the legacy loan remains unchanged.

Expected: no migration backfill, no date-only runtime enrollment, and no way to
edit policy fields through create/update requests.

### 2. Weekly penalty tiers and Friday cutoff

For eligible loans with weekly amortization below PHP 1,000, from PHP 1,000 to
below PHP 2,000, and PHP 2,000 or higher:

1. Leave one due installment unpaid through Friday.
2. Run the sweep on/after Saturday Manila business date.
3. Confirm exactly one PHP 50/PHP 100/PHP 200 weekly accrual respectively.
4. Run the sweep again and confirm no duplicate event or total increase.

Repeat with a partial installment collected by Friday. Expected: the full tier
penalty still applies. Repeat with the installment fully collected by Friday.
Expected: no weekly penalty, even when staff approval occurs later and the
stored collection date remains on time.

### 3. Maturity and PDI

1. Use an eligible loan with unpaid principal at final due date.
2. Confirm no additional weekly penalty is created after maturity.
3. Run the sweep starting the day after final due date.
4. Confirm one maturity penalty equal to 30% of remaining scheduled principal.
5. Confirm one PDI event per overdue day using principal x 10% / 30.
6. Approve a principal-reducing payment and run the next sweep.
7. Confirm later daily PDI uses the lower principal and never includes prior PDI
   in its base.
8. Repeat the sweep and confirm maturity/PDI events are idempotent.

### 4. Payment allocation and savings

1. Create outstanding penalty, PDI, and contractual balance on one eligible
   loan.
2. Submit a payment smaller than the combined outstanding amount.
3. In **Approvals**, open the approval dialog and verify the server preview shows
   penalty first, PDI second, and loan amount third.
4. Approve and open loan history.
5. Confirm charge-payment ledger rows match the preview.
6. Confirm only the contractual portion changed `amountPaid`, `balance`, the
   repayment schedule, and collection received amount.
7. Repeat with **Use Savings** and confirm the savings debit equals charge plus
   contractual savings portions.
8. Confirm an overpayment is rejected instead of silently disappearing.

### 5. Exact reversal

1. Request reversal of a payment that covered penalty, PDI, contractual amount,
   and savings.
2. Approve the reversal as manager.
3. Confirm contractual schedule/balance rollback equals the original
   contractual allocation only.
4. Confirm savings is restored exactly once.
5. Confirm each original charge-payment ledger row has one
   `payment_reversal` row referencing it.
6. Confirm charge outstanding totals reopen and reconciliation remains matched.
7. Confirm a duplicate reversal is rejected.

### 6. Manager waiver and completion

1. Open **Waivers** as manager and select an enrolled loan with charges.
2. Apply a partial penalty/PDI waiver and verify totals/history.
3. Try a waiver above outstanding; expect rejection.
4. Pay contractual balance while charges remain; confirm loan stays active.
5. Try reloan while charges remain; expect rejection.
6. Pay or waive all remaining charges; confirm a zero-contractual-balance loan
   can complete and reloan eligibility no longer reports charge debt.
7. Confirm cashier/loan processor cannot call waiver or manual-sweep endpoints.

### 7. Concurrency and failure safety

1. Trigger two manual/worker sweeps together.
2. Confirm one obtains the PostgreSQL advisory lock and totals are not doubled.
3. Attempt two approvals against the same loan concurrently.
4. Confirm pessimistic loan locking prevents over-allocation.
5. Force an approval transaction failure after allocation in staging.
6. Confirm repayment, savings, schedules, loan summaries, and charge ledger all
   roll back together.

## API Verification

All paths use the configured API base ending in `/api`.

- `GET /loans/:loanId/charges` - policy, summaries, history, reconciliation.
- `GET /repayments/:repaymentId/allocation-preview` - manager-only dry-run using
  the same charge posting/allocation services; the transaction is rolled back.
- `POST /loans/:loanId/waivers` - manager-only waiver.
- `POST /loans/charges/sweep` - manager-only distributed/manual sweep.

## Automated Validation

From `server`:

```powershell
npm.cmd run build
npm.cmd test -- --runInBand
```

From `client`, with a non-secret HTTPS API URL:

```powershell
$env:VITE_API_URL='https://api.example.com/api'
npm.cmd run build
npm.cmd test
```

For database migration/concurrency tests, use an isolated PostgreSQL test
database. Never point destructive or rollback tests at production.

## Rollback

1. Immediately set `LOAN_CHARGE_SCHEDULER_ENABLED=false`.
2. Remove both new-loan enrollment variables to stop new enrollment.
3. Preserve `loan_charge_ledger`; do not delete or edit financial history.
4. Reconcile affected loan IDs and identify incorrect events.
5. Use approved compensating payments/reversals or manager waivers as directed
   by the business owner.
6. Roll application code back only after confirming older code can safely read
   the migrated schema.
7. Prefer a reviewed forward-fix migration; only run migration `down` when the
   ledger is empty and production accounting has explicitly approved it.
