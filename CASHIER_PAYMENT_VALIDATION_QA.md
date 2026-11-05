# Cashier Excess-Payment Validation: Manual QA

## What changed

- The cashier payment dialog loads a current, server-calculated maximum cash
  payment and blocks excessive amounts before submission.
- Advance payments may exceed the weekly installment, but not the remaining
  payable amount. A PHP 450 final balance cannot accept PHP 550 cash.
- For policy-enrolled loans, payable amounts include applicable outstanding
  penalties and past-due interest, not just the contractual loan balance.
- Pending payments reserve cash plus their projected savings usage. Pending
  reversals do not increase available payment capacity before approval.
- The backend checks again under a loan row lock before creating a posting.
  Invalid submissions create neither a pending payment nor a collection batch.
- Approval still rechecks current balances. A legacy overpayment can no longer
  silently increase amount paid while its balance is clamped to zero.
- Existing savings allocation, advance-payment distribution, policy enrollment,
  and charge formulas are retained. No database migration is required.

## 1. Open the prepared local application

These are fictional records in the **Supabase development database**.
Production was not accessed or changed. Existing records and account passwords
were not edited. Five manual fixtures are separate from automated-test fixtures.

1. Open `http://127.0.0.1:5176/login`.
2. From the repository root, open the ignored credentials file:

   ```powershell
   notepad node_modules/.cache/dcla-cashier-limit-qa/credentials.txt
   ```

3. Log in using its **cashier** credentials.
4. Open **Collections**. Search centers for
   `QA CASHIER LIMIT 1029 - MANUAL`.
5. Click **View Details** for that exact center.
6. The prepared collection date is **October 29, 2026**, a Thursday. If testing
   on another day, use **Collections by Date** and select that date.
7. Search the member list by first name, then click that borrower's **Payment**.

Do not use ports 5173 or 5175 for these checks: they may point at older API
processes. The prepared frontend is on **5176**, using the updated API on **3002**.

### Prepared manual fixtures

| Borrower | Loan balance | Weekly installment | Pending payment | Maximum cash at preparation |
| --- | ---: | ---: | ---: | ---: |
| Alma QA Final | PHP 450 | PHP 550 | None | PHP 450 |
| Ben QA Advance | PHP 6,500 | PHP 550 | None | PHP 6,500 |
| Cora QA Savings | PHP 450 | PHP 550 | None | PHP 450 |
| Dino QA Pending | PHP 450 | PHP 550 | PHP 350 | PHP 100 |
| Grace QA Charges | PHP 5,500 | PHP 1,370 | None | PHP 7,533.38 on October 29 |

Each borrower starts these manual checks with **PHP 500 savings**. Alma, Cora,
and Dino already have a PHP 6,050 approved setup payment, leaving PHP 450.
Grace is policy-enrolled; the other four loans are legacy fixtures. Grace's
maximum includes projected charges and changes as business dates or payments
change. Use the freshly loaded maximum, not a hardcoded amount, on later days.

The QA API has SMS sending, the SMS worker, charge scheduling, schema sync,
and automatic migrations disabled. Quotes project eligible charges in a rolled-back
transaction; opening a quote must not itself post charges or change balances.
Other already-running local services were not stopped or reconfigured.

## 2. Reject excess final cash without submitting

1. Open **Alma QA Final → Payment**.
2. Wait for **Maximum cash payment: PHP 450** to load. The displayed currency
   formatting may use the peso symbol and two decimal places.
3. Enter `550`.
4. Verify the amount field shows an excess-payment error and **Process Payment**
   is disabled.
5. Open browser developer tools → **Network**, filtered to `repayments`.
   There must be no repayment **POST** from entering this invalid amount.
   The initial payment-limit **GET** is expected.
6. Enter `450.01`: submission must remain disabled.
7. Enter `450`: submission should be enabled.
8. Click **Cancel** for now.

**Acceptance:** Incorrect cash is blocked before submission; PHP 450 is allowed.
Alma's balance, approved amount paid, savings, and pending payments remain unchanged.

## 3. Preserve valid advance payments

1. Open **Ben QA Advance → Payment**.
2. Verify the maximum is **PHP 6,500**, despite the **PHP 550 weekly installment**.
3. Enter `1100`: **Process Payment** must be enabled.
4. Enter `6500`: it must still be enabled.
5. Enter `6500.01`: it must be disabled with an excess-payment error.
6. Enter `1100.001`: fractional-cent cash must also be rejected.
7. Click **Cancel** unless you want to consume this fixture by submitting PHP 1,100.

**Acceptance:** The weekly installment is not incorrectly used as the cash cap.
If you submit PHP 1,100, it is pending first; only after approval should Ben's
balance become **PHP 5,400**, amount paid **PHP 1,100**, savings still **PHP 500**.

## 4. Reserve pending payments

1. Open **Dino QA Pending → Payment**.
2. Verify the maximum is **PHP 100**, with a notice about **PHP 350 reserved**
   by pending payments. The actual loan balance is still PHP 450.
3. Enter `101`: submission must be disabled.
4. Enter `100`: submission should be enabled.
5. Click **Cancel** to preserve this fixture.

**Acceptance:** Two unapproved payments cannot together exceed the payable balance.
Pending is a reservation, not an already-approved payment. Rejected payments no
longer reserve funds; an unapproved reversal does not create new payment capacity.

Do not use **Reject Collection** merely to test one borrower: it rejects all
pending entries in that selected collection. Per-posting rejection UI is not
part of this feature.

## 5. Check final-payment savings

1. Open **Cora QA Savings → Payment**.
2. Enter `200`, then select **Use savings**.
3. Verify the proposed savings use is **PHP 250**, not PHP 350. The target is
   the PHP 450 final balance, not the PHP 550 scheduled weekly installment.
4. **Process Payment** should be enabled.
5. To test without consuming data, click **Cancel**.
6. Alternatively, submit this payment. It should remain pending without
   reducing the actual balance or savings yet.
7. Log in as the QA **admin**, open **Approvals**, search for the exact manual
   center, and inspect every borrower and amount before confirming.
8. If you approve this payment, verify Cora's balance becomes **PHP 0**,
   amount paid **PHP 6,500**, status **Paid**, and savings **PHP 250**.
9. Reload and confirm a single PHP 250 repayment-related savings debit persists.

**Acceptance:** Cash plus savings cannot over-settle the final balance, savings
are deducted once at approval, and cancelled/pending payments do not debit savings.

## 6. Include legitimate charges

1. Open **Grace QA Charges → Payment**.
2. Note the freshly loaded maximum. At preparation on October 29, it was
   **PHP 7,533.38**: PHP 5,500 contractual balance plus PHP 2,033.38 projected charges.
3. Enter `5501`: submission should be enabled because legitimate charges make
   the total payable larger than the contractual balance.
4. Enter one cent above the displayed maximum: submission must be disabled.
5. Click **Cancel** to preserve this fixture.
6. As admin, inspect Grace's loan history. Merely opening and cancelling the
   payment dialog must not add charge events, payment entries, or savings debits.

**Acceptance:** Validation neither ignores legitimate charges nor creates a
ledger entry merely to display a maximum. Charges are calculated by the existing
policy engine, not by a new formula or loan enrollment rule.

## 7. Complete an exact payment and check persistence

Do this after the non-destructive checks; it consumes Alma's final-payment fixture.

1. As cashier, submit **PHP 450**, without savings, for **Alma QA Final**.
2. Confirm success and one pending posting. Her actual balance must remain
   **PHP 450**, amount paid **PHP 6,050**, and savings **PHP 500** until approval.
3. Log out and sign in with the QA admin credentials from the same local file.
4. Open **Approvals**, search `QA CASHIER LIMIT 1029 - MANUAL`, and click **Approve**.
5. Review every entry before confirming. Dino's seeded PHP 350 is also in this
   center/date collection; collection approval includes it and any other valid
   manual payments you submitted. Do not base associations on row order.
6. Approve the collection once. Close any SMS dialog without sending.
7. Open **Members**, search Alma, and inspect her loan history:
   - **Balance:** PHP 0.
   - **Amount paid:** PHP 6,500.
   - **Status:** Paid.
   - **Savings:** PHP 500.
   - One new approved PHP 450 payment; no duplicate.
8. If Dino was approved too, his balance should now be **PHP 100**, amount paid
   **PHP 6,400**, and savings **PHP 500** (unless you submitted another Dino payment).
9. Reload, then log out/in and verify the same totals persist.
10. A paid loan must no longer accept a new payment.

**Acceptance:** Validation allows a genuine final settlement and does not break
posting, approval, schedule distribution, savings, or persisted loan history.

## 8. Optional stale-quote check

Use **Ben**, before submitting other payments for him, and two browser sessions:

1. In the cashier session, open Ben's Payment dialog and leave it open at a
   PHP 6,500 maximum.
2. In an admin session on the same local app, post and approve **PHP 6,000**
   for Ben. Verify his actual balance becomes **PHP 500**.
3. Back in the still-open cashier dialog, enter `1100` and submit.
4. The backend must reject the stale submission and the dialog must reload
   the current maximum of **PHP 500**. There must be no new pending PHP 1,100.

**Acceptance:** An old browser limit cannot bypass the backend's current balance
check. This is a deliberately destructive QA scenario for Ben's dummy loan only.

## Automated verification performed

- Actual Chrome cashier login, Collections navigation, invalid-input blocking,
  valid advance/exact amounts, final savings preview, and a 390px viewport.
- Actual browser final PHP 450 submission, admin approval through the API,
  database verification, reload, paid status, and unchanged savings.
- Actual stale browser quote: another approved payment reduced PHP 450 to
  PHP 250; submission of PHP 400 returned 400, refreshed the displayed limit,
  and created no pending posting.
- Direct API excess, fractional-cent, negative, paid-loan, and duplicate-approval
  attempts were rejected; financial snapshots were compared before and after.
- Two simultaneous PHP 300 requests against PHP 450: exactly one succeeded;
  the other returned 400, leaving one pending payment and PHP 150 capacity.
- Rejection freed a reservation; normal admin auto-approval still persisted.
- Cash PHP 200 plus savings PHP 250 settled PHP 450 and debited savings once.
- Enrolled charge projection and invalid submissions left the charge ledger
  unchanged; a legitimate charge-inclusive payment followed existing allocation.
- Five manual fixtures were verified unchanged after automated testing.
- Approved repayment schedule totals matched the corresponding loan balances;
  the enrolled loan's charge-ledger reconciliation returned matched.

Local scripts, state, credentials, and detailed results are in ignored
`node_modules/.cache/dcla-cashier-limit-qa/`. Automated cases use a separate
`QA CASHIER LIMIT 1029 - AUTOMATED` center and have already consumed their
fixtures. Do not rerun those mutation scripts against consumed data or production.

### Regression/build results

- Frontend: **295 tests passed across 55 files** on the final source, including
  seven payment-dialog tests. The JSON report is in ignored
  `node_modules/.cache/dcla-cashier-limit-qa/vitest-results.json`.
- Backend: **370 tests passed across 55 suites**. The full command still exits
  nonzero because the pre-existing `server/src/common/pagination-limits.spec.ts:16`
  has a TypeScript TS2769 compile error. It was not modified for this task.
- Backend build, frontend type-check/build, and lint of changed files passed
  during implementation. Existing large-bundle build warnings remain.

## Restarting the prepared local setup

Use Node **20.19+ within Node 20**, and confirm `server/.env` still points at
your **development Supabase** database. The prepared processes are already
running; do not launch duplicate copies on occupied ports.

If they stop, from the repository root in PowerShell:

```powershell
cd server
$env:PORT='3002'
$env:SMS_ENABLED='false'
$env:SMS_WORKER_ENABLED='false'
$env:LOAN_CHARGE_SCHEDULER_ENABLED='false'
$env:TYPEORM_SYNC='false'
$env:TYPEORM_RUN_MIGRATIONS='false'
$env:CLIENT_URL='http://127.0.0.1:5176,http://localhost:5176'
npm.cmd run start:dev
```

In a second terminal from the repository root:

```powershell
cd client
$env:VITE_API_URL='http://127.0.0.1:3002/api'
npm.cmd run dev -- --host 127.0.0.1 --port 5176 --strictPort
```

Readiness: `http://127.0.0.1:3002/health/ready` should return `{"status":"ok"}`.
Use **Collections by Date → October 29, 2026** to find these fixtures on a later day.
If `node_modules` is replaced, the ignored credential/state files may be lost;
retain the development login details securely if you need them later.

## Deployment and scope

1. Complete the manual checks, obtain code review, and retain the normal backup
   and deployment safeguards. Passing tests does not guarantee zero production risk.
2. Deploy the **backend first**, verify readiness, then deploy the frontend.
   The new frontend requires the new payment-limit endpoint and intentionally
   blocks posting if it cannot load a valid limit.
3. No new migration, environment variable, production enrollment change, or
   scheduler activation is required. Do not copy QA settings/accounts to Render.
4. Check production cashier loading and role access without posting dummy money.
   Monitor validation errors, database locks/timeouts, and approval failures.
5. Existing invalid pending postings are not automatically corrected or deleted.
   They still require reconciliation. This change does not add per-posting
   rejection or make collection-wide approval atomic.
6. Daily eligible-charge projection uses the existing policy logic and may take
   longer on loans with long overdue histories. A timeout fails closed; do not
   bypass the limit or force an amount through another endpoint.
7. Keep QA passwords out of Git. Disable the dedicated QA accounts after testing
   if no longer needed; do not delete financial history to reset the fixtures.
