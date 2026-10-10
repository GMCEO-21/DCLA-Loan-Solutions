# DCLA-06 Production Activation Handoff

## Purpose

This document transfers the complete working context for activating the
Penalty and Past-Due Interest Computation feature on a different computer and
in a new Codex session.

Read this file before changing code, Render variables, Supabase data, or the
charge scheduler.

## Current Production State

As of October 10, 2026:

- The DCLA-06 code and database migration are deployed to production.
- Production database backup was completed before deployment.
- Migration `1789344000000-AddLoanChargePolicyAndLedger` completed
  successfully.
- Render backend deployment completed successfully.
- Netlify frontend deployment completed successfully.
- Production frontend: `https://dclalending.netlify.app`
- Production API: `https://dcla-loan-solutions-nl1d.onrender.com`
- Readiness endpoint:
  `https://dcla-loan-solutions-nl1d.onrender.com/health/ready`
- The readiness endpoint returned `{"status":"ok"}`.
- Existing production loans display **Legacy / Not Applicable**.
- The production **Waivers** page loaded successfully with zero outstanding
  automated charges during dark-deployment verification.
- Existing collections, payments, savings, approvals, and other existing-loan
  transactions were allowed to resume.
- New loans and reloans were placed on hold until policy activation.
- The client confirmed **October 11, 2026** as the production activation date.

The automatic scheduler must remain disabled until the controlled enrolled-loan
verification and first eligible manual sweep pass.

## Git State

Production/release branch:

```text
v2.0.0
```

The implementation and QA evidence are already ancestors of
`origin/v2.0.0`.

Important commits:

```text
e1ef5b7 feat: implement penalty-past-due
d3caae5 feat(loans): implement opt-in penalties and past-due interest
3ac3992 test(loans): document DCLA-06 acceptance results
```

When this handoff was written, remote `v2.0.0` was at:

```text
9059318 Show retained savings without active loan
```

Later commits may exist by October 11. Do not reset or force-push the release
branch.

## New-Machine Setup

On the new computer:

```bash
git clone https://github.com/GMCEO-21/DCLA-Loan-Solutions.git
cd DCLA-Loan-Solutions
git checkout v2.0.0
git pull origin v2.0.0
git status
git log -5 --oneline
```

Confirm the DCLA-06 QA commit is present:

```bash
git merge-base --is-ancestor 3ac3992 HEAD
```

Exit code `0` means the commit is included.

Use Node.js `20.19.0` for both applications.

Do not copy local `.env` files between machines through Git. Production secrets
remain in Render and Netlify.

## Required Reading Order

The new Codex session must read these files in order:

1. `DCLA_06_ACTIVATION_HANDOFF.md`
2. `DCLA_06_PRODUCTION_DEPLOYMENT_NOTES.md`
3. `DCLA_06_QA_EXECUTION_REPORT.md`
4. `DCLA_06_QA_ROLLOUT.md`
5. `DCLA_06_MANUAL_QA_CHECKLIST.md`
6. `DEPLOYMENT.md`
7. `COLLECTIONS_FLOW.md`
8. `ARCHITECTURE.md`

## Confirmed Business Rules

- Only loans and reloans released on or after the activation date are enrolled.
- Existing loans are never backfilled or automatically enrolled.
- Policy enrollment is immutable per loan.
- Weekly penalty assessment occurs after the Friday cutoff.
- Weekly amortization below PHP 1,000 receives a PHP 50 penalty.
- Weekly amortization from PHP 1,000 to below PHP 2,000 receives a PHP 100
  penalty.
- Weekly amortization PHP 2,000 or above receives a PHP 200 penalty.
- Partial weekly payment does not avoid the weekly penalty.
- The full weekly installment must be paid by cutoff to avoid the penalty.
- Weekly penalties stop after maturity.
- Starting the day after final due date, the loan receives one 30% maturity
  penalty based on remaining principal.
- Daily PDI is remaining principal x 10% / 30.
- PDI is simple and non-compounding.
- Daily PDI decreases when approved principal payments reduce remaining
  principal.
- Payment allocation order is penalty, PDI, then contractual loan balance.
- Charge payments do not increase contractual `amountPaid`.
- Managers can waive all weekly penalties, maturity penalties, and PDI.
- Charges must be paid or waived before completion or reloan.

## Production Environment Before Activation

Verify the Render API currently has:

```env
NODE_ENV=production
TYPEORM_SYNC=false
TYPEORM_RUN_MIGRATIONS=false
LOAN_CHARGE_SCHEDULER_ENABLED=false
```

Before activation, the two policy variables should either be absent or already
configured with the confirmed future date. In either case, the scheduler must
remain `false`.

Do not modify `PORT`; Render supplies it.

## October 11 Activation Procedure

Perform these steps before allowing new loan or reloan creation.

### 1. Confirm Production Health

Open:

```text
https://dcla-loan-solutions-nl1d.onrender.com/health/ready
```

Required response:

```json
{"status":"ok"}
```

Stop if the endpoint returns 503, `unavailable`, 404, or cannot connect.

### 2. Configure Policy Enrollment

In Render, open the production API service and select **Environment**.

Set these exact values without quotes:

```env
NEW_LOAN_OVERDUE_CHARGE_POLICY_VERSION=DCLA_2026_V1
OVERDUE_CHARGE_POLICY_ACTIVATION_DATE=2026-10-11
LOAN_CHARGE_SCHEDULER_ENABLED=false
```

Keep:

```env
TYPEORM_SYNC=false
TYPEORM_RUN_MIGRATIONS=false
```

Save the environment changes and restart/redeploy the Render service.

### 3. Verify Restart

- Wait until the Render deployment is live.
- Confirm `/health/ready` returns `{"status":"ok"}`.
- Review Render startup logs.
- Stop if configuration validation, database, migration, or startup errors
  appear.
- Confirm logs do not show the loan charge scheduler as enabled.

### 4. Create One Controlled New Loan

Use one client-approved loan or reloan released on October 11, 2026.

Immediately open its loan history and verify:

- Policy displays `DCLA_2026_V1`.
- Effective date is `2026-10-11` when the release date is October 11.
- Penalty and PDI totals are PHP 0 before any eligible cutoff or maturity.
- **Ledger reconciliation: Matched** is displayed.
- The repayment schedule and contractual amounts are correct.

Open one older production loan and verify it still displays
**Legacy / Not Applicable**.

Stop and remove the policy variables if the new loan is not enrolled correctly
or any older loan changes.

### 5. Resume New Loans and Reloans

Once the controlled loan is correct, notify the client that new loans and
reloans may resume. Every qualifying loan released on or after October 11 will
be stamped with `DCLA_2026_V1`.

Keep `LOAN_CHARGE_SCHEDULER_ENABLED=false` until the first controlled sweep.

## Controlled Manual Sweep

Do not run an early sweep merely to force a charge. Wait until an enrolled loan
has genuinely passed its applicable Friday cutoff or maturity date.

Use the repayment schedule shown in the loan history:

1. Identify the first scheduled due date.
2. Identify the first Friday cutoff following that due date.
3. Run the sweep on or after the following Saturday, Manila business date.
4. Log in as admin or manager.
5. Open **Waivers**.
6. Click **Run Charge Sweep**.
7. Require `failedCount = 0`.
8. Verify the expected tier or maturity/PDI amount.
9. Verify the charge base, rate, period, and policy version.
10. Verify **Ledger reconciliation: Matched**.
11. Run the sweep again.
12. Confirm the second run creates zero duplicate events.

Do not enable automation if any amount is unexpected or reconciliation does
not match.

## Enable Automated Sweeps

Only after the controlled manual sweep and client sign-off, set in Render:

```env
LOAN_CHARGE_SCHEDULER_ENABLED=true
LOAN_CHARGE_POLL_INTERVAL_MS=3600000
LOAN_CHARGE_BATCH_SIZE=100
```

Restart the Render API and verify health again.

Monitor:

- Sweep scanned, processed, charge, and failure counts.
- Database connection errors.
- Duplicate-event errors.
- Reconciliation errors.
- Payment, reversal, and waiver behavior.
- Render restarts and health status.

The automated sweep records charges owed. It does not automatically deduct
money from a client.

## What the Sweep Does

The sweep is newly implemented as part of this feature. It:

- Scans active loans enrolled in `DCLA_2026_V1`.
- Detects overdue weekly installments and matured loans.
- Calculates applicable charges.
- Creates append-only charge-ledger entries.
- Uses deterministic idempotency keys to prevent duplicates.
- Skips every legacy loan.

With the scheduler disabled, an authorized admin/manager can run the same logic
manually from **Waivers**. Payment processing also assesses the specific
enrolled loan being paid.

## Automated QA Evidence

Development QA completed successfully:

- 46 automated financial acceptance checks passed.
- PHP 50, PHP 100, and PHP 200 weekly tiers passed.
- Full and partial payment behavior passed.
- Maturity penalty and daily non-compounding PDI passed.
- Payment allocation priority passed.
- Exact reversal and duplicate-reversal rejection passed.
- Partial/full waiver behavior passed.
- Legacy isolation passed.
- First sweep created expected events with zero failures.
- Second sweep created zero duplicate events.
- Ledger reconciliation remained matched.
- Client test suite: 48 suites and 184 tests passed under Node 20.19.
- DCLA-focused server suite: 9 suites and 75 tests passed.
- Server and client production builds passed.

See `DCLA_06_QA_EXECUTION_REPORT.md` for the detailed evidence.

One unrelated pre-existing TypeScript compilation issue was observed in
`server/src/common/pagination-limits.spec.ts`; the file was not changed by
DCLA-06. DCLA-focused tests and production builds passed.

## Emergency Stop and Rollback

If unexpected behavior occurs:

1. Set `LOAN_CHARGE_SCHEDULER_ENABLED=false`.
2. Remove `NEW_LOAN_OVERDUE_CHARGE_POLICY_VERSION`.
3. Remove `OVERDUE_CHARGE_POLICY_ACTIVATION_DATE`.
4. Restart the Render API.
5. Confirm `/health/ready` returns `{"status":"ok"}`.
6. Record affected loan IDs and ledger entries.
7. Preserve `loan_charge_ledger`; never delete or edit financial history.
8. Use approved reversals, waivers, or reviewed compensating actions.

Do not run migration `down` after production charge-ledger entries exist.

Removing enrollment variables stops future loans from being enrolled. It does
not erase policy enrollment from loans already stamped after activation.

## Hard Stop Conditions

Stop activation immediately if any of these occur:

- `/health/ready` is not healthy.
- Render fails environment validation or startup.
- The controlled new loan remains legacy.
- An existing loan becomes enrolled.
- A charge appears before its cutoff or maturity date.
- Sweep `failedCount` is greater than zero.
- A repeated sweep creates a duplicate charge.
- Ledger reconciliation does not match.
- Contractual `amountPaid` includes charge payments.
- Production database connectivity is unstable.

## Ready-to-Paste Prompt for the New Codex Session

Paste the following after cloning and opening the repository:

```text
Act as the senior software engineer responsible for the October 11 production
activation of DCLA-06: Penalty and Past-Due Interest Computation.

First read DCLA_06_ACTIVATION_HANDOFF.md completely, followed by the documents
listed in its Required Reading Order. Inspect the current v2.0.0 branch and
production configuration before recommending or changing anything.

Current known state: code and migration are deployed, production backup is
complete, existing loans are legacy, /health/ready was healthy, client approved
2026-10-11 as the activation date, and the scheduler must remain disabled until
a controlled enrolled loan and manual sweep pass. Do not backfill legacy loans,
do not run migration down, do not delete ledger history, and do not enable the
scheduler early.

Guide me one step at a time through Render policy activation, controlled-loan
verification, legacy isolation verification, the first eligible manual sweep,
idempotency/reconciliation checks, and only then scheduler activation. Stop on
any failed gate. Be direct and do not use placeholders when an exact value is
already documented.
```

## Client Communication for October 11

After the controlled new loan is verified:

> Sir, successfully activated na ang new Penalty and Past-Due Interest policy.
> Pwede na mo-resume sa new loans ug reloans. Only loans released starting
> October 11, 2026 ang covered; existing loans remain unaffected. The automatic
> charge sweep will remain under controlled monitoring until final verification.

