# DCLA-06 Automated QA Execution Report

## Execution

- Date: October 7, 2026 (Manila business date)
- Environment: development database
- Policy: `DCLA_2026_V1`
- Scheduler: disabled
- QA prefix: `DCLA06_AUTOMATED_QA_1791335821455`
- Database snapshot: `dcla06_qa_backup_20261007`
- Snapshot contents: 16 public tables and 15,800 rows

The snapshot was created before the automated financial scenarios. It is stored
as a separate schema in the configured development database. The local manifest
is `DCLA_06_QA_BACKUP_MANIFEST.json` and must not be committed as deployment
configuration.

## Automated Validation

- Supported runtime: Node.js `20.19.0`
- Client: 48 test suites and 184 tests passed
- DCLA-focused server tests: 9 suites and 75 tests passed
- Full server behavior: 52 suites and 260 tests passed
- Server production build: passed
- Client production build: passed

One unrelated existing TypeScript compilation failure remains in
`server/src/common/pagination-limits.spec.ts`. That file is unchanged by the
DCLA-06 branch.

## Database Isolation

Before automated fixture creation:

- Legacy loans: 640
- Policy-enrolled QA loans: 1
- Invalid policy field pairs: 0
- Duplicate charge-ledger idempotency keys: 0

The automated run verified that a selected legacy control loan retained the
same balance, amount paid, savings, and policy fields.

## Charge Sweep

The automated run created seven dedicated policy-enrolled QA loans.

First sweep as of October 7, 2026:

- Loans scanned: 8
- Loans processed: 8
- Charge events created: 59
- Failures: 0

Second sweep for the same date:

- Loans scanned: 8
- Loans processed: 8
- Charge events created: 0
- Failures: 0

This confirms sweep idempotency for the tested records and periods.

## Acceptance Results

All 46 automated checks passed, including:

- PHP 50, PHP 100, and PHP 200 weekly penalty tiers.
- Full payment before cutoff avoids the weekly penalty.
- Partial payment receives the full weekly penalty and settles charges first.
- Charge payments do not increase contractual `amountPaid`.
- Weekly penalties stop after maturity.
- One-time 30% maturity penalty uses remaining principal.
- Twenty-four daily non-compounding PDI entries total PHP 319.92.
- Payment allocation follows penalty, PDI, then contractual balance.
- A PHP 2,000 payment allocates PHP 1,500 to penalty, PHP 319.92 to PDI,
  and PHP 180.08 to the contractual loan.
- Payment reversal reopens exact charges and restores the contractual balance.
- Duplicate reversal is rejected.
- Partial and full waivers preserve the contractual balance.
- A waiver above outstanding charges is rejected.
- Fully waived loans leave the waiver-candidate list.
- Ledger reconciliation remains matched after accrual, payment, reversal, and
  waiver operations.
- The selected legacy control loan remains unchanged.

## Operational Observation

The background SMS worker experienced one transient Supabase pooler disconnect
during the run. The financial QA transactions completed successfully, with all
46 checks passing. This matches the previously observed recoverable development
pooler behavior and did not affect charge processing.

## Readiness Conclusion

The DCLA-06 financial behavior passed automated development QA. Production
deployment must still follow the phased rollout in `DCLA_06_QA_ROLLOUT.md`:

1. Back up production.
2. Deploy migration and code with enrollment disabled and scheduler disabled.
3. Verify legacy production loans remain unchanged.
4. Configure the client-approved activation date while keeping the scheduler
   disabled.
5. Validate a controlled newly released loan and reconciliation.
6. Enable the scheduler only after production sign-off.
