# DCLA-06 Production Deployment Notes

## Deployment Status

DCLA-06 has passed automated development QA. Deploying the code and activating
automatic charging are separate operations. The safest rollout deploys the
schema and application first with enrollment and the scheduler disabled.

## 1. Commit the QA Evidence

Commit only the intended repository files:

```bash
git add DCLA_06_MANUAL_QA_CHECKLIST.md DCLA_06_QA_EXECUTION_REPORT.md client/src/components/header/Header.test.tsx
git commit -m "test(loans): document DCLA-06 acceptance results"
git push
```

Do not commit `DCLA_06_QA_BACKUP_MANIFEST.json`. It describes the local
development-database snapshot and is excluded locally from Git status.

Open and review a pull request from `feature/penalty-past-due-v2` into
`v2.0.0`.

## 2. Prepare Render for Dark Deployment

Before merging or deploying, configure the Render API service with:

```env
NODE_ENV=production
TYPEORM_SYNC=false
TYPEORM_RUN_MIGRATIONS=false
LOAN_CHARGE_SCHEDULER_ENABLED=false
```

Temporarily remove or leave undefined:

```env
NEW_LOAN_OVERDUE_CHARGE_POLICY_VERSION
OVERDUE_CHARGE_POLICY_ACTIVATION_DATE
```

Verify the Render service configuration:

```text
Root directory: server
Build command: npm ci --include=dev && npm run build
Pre-deploy command: npm run migration:run
Start command: npm run start:prod
Health check path: /health/ready
Node version: 20.19.0
```

The production database connection, TLS certificate, JWT secrets, CORS origin,
and SMS settings must remain configured according to `DEPLOYMENT.md`.

## 3. Back Up Production

Before deployment:

1. Create a production database backup in Supabase.
2. Confirm that the backup completed successfully.
3. Record the backup timestamp and deployment commit SHA.
4. Confirm that `LOAN_CHARGE_SCHEDULER_ENABLED=false` in Render.
5. Confirm that both policy-enrollment variables are absent.

Do not continue if the backup cannot be verified.

## 4. Deploy the Schema and Application

1. Merge the approved pull request into `v2.0.0`.
2. Allow Render to deploy the backend first.
3. Confirm the pre-deploy migration completes successfully.
4. Confirm migration `1789344000000-AddLoanChargePolicyAndLedger` is applied.
5. Confirm `/health/ready` reports healthy.
6. Review startup logs for database, migration, or configuration failures.
7. Allow Netlify to deploy the frontend.
8. Confirm Netlify uses the production Render URL ending in `/api` as
   `VITE_API_URL`.

At this point, the DCLA-06 code and schema are deployed, but no new loan is
enrolled because the policy variables remain undefined.

## 5. Verify Dark Deployment

Log in to the production application as an admin or manager and verify:

- Existing loans display **Legacy / Not Applicable**.
- Existing balances, amount paid, savings, and repayment schedules are
  unchanged.
- Existing loan creation, payment approval, reversal, savings, and reloan
  workflows still operate normally.
- The **Waivers** page loads successfully.
- Running a charge sweep with no enrolled loans reports zero failures and does
  not modify legacy loans.
- API readiness remains healthy.

Stop the rollout if any legacy financial value changes.

## 6. Confirm the Activation Date

Obtain written client approval for the exact activation date. The date means:

- Only loans created or released on or after the activation date are enrolled.
- Existing loans are never backfilled.
- New reloans created on or after the activation date are enrolled.

Do not copy the development activation date into production.

Client-confirmed production activation date:

```env
OVERDUE_CHARGE_POLICY_ACTIVATION_DATE=2026-10-11
```

## 7. Activate New-Loan Enrollment

Using the client-confirmed activation date, configure Render:

```env
NEW_LOAN_OVERDUE_CHARGE_POLICY_VERSION=DCLA_2026_V1
OVERDUE_CHARGE_POLICY_ACTIVATION_DATE=2026-10-11
LOAN_CHARGE_SCHEDULER_ENABLED=false
```

Restart the Render API service.

Create one controlled newly released loan and verify:

- Policy displays `DCLA_2026_V1`.
- The effective date equals the loan release date.
- Existing loans remain **Legacy / Not Applicable**.
- No charge exists before an eligible cutoff or maturity date.
- **Ledger reconciliation: Matched** is displayed.

Keep the scheduler disabled during this verification.

## 8. Run a Controlled Manual Sweep

After the controlled loan reaches an eligible Friday cutoff or maturity date:

1. Log in as an admin or manager.
2. Open **Waivers**.
3. Select **Run Charge Sweep**.
4. Confirm the sweep reports zero failures.
5. Open the controlled loan history.
6. Verify the amount, charge type, base, rate, period, and policy version.
7. Verify **Ledger reconciliation: Matched**.
8. Run the sweep again and confirm zero duplicate events are created.

Do not enable the scheduler if reconciliation does not match.

## 9. Enable Automated Sweeps

After the controlled sweep and client sign-off, configure Render:

```env
LOAN_CHARGE_SCHEDULER_ENABLED=true
LOAN_CHARGE_POLL_INTERVAL_MS=3600000
LOAN_CHARGE_BATCH_SIZE=100
```

Restart the Render API service and monitor:

- Sweep scanned, processed, charge, and failure counts.
- Database connectivity errors.
- Duplicate-event or reconciliation errors.
- Payment, reversal, and waiver processing.
- Render health and restart events.

## 10. Rollback and Emergency Stop

If unexpected behavior occurs:

1. Immediately set `LOAN_CHARGE_SCHEDULER_ENABLED=false`.
2. Remove `NEW_LOAN_OVERDUE_CHARGE_POLICY_VERSION`.
3. Remove `OVERDUE_CHARGE_POLICY_ACTIVATION_DATE`.
4. Restart the Render API service.
5. Preserve `loan_charge_ledger`; never delete or edit financial history.
6. Record affected loan IDs and reconcile every charge.
7. Use approved reversals, waivers, or reviewed compensating entries.
8. Restore application code only after confirming it can safely read the
   migrated schema.

Do not run the migration `down` after production ledger entries exist.

## Final Go/No-Go Gates

Production activation is approved only when all gates pass:

- Production backup is verified.
- Pull request is reviewed and merged.
- Render migration succeeds.
- Backend and frontend deployments succeed.
- API readiness is healthy.
- Legacy-loan smoke testing passes.
- Client-approved activation date is configured.
- Controlled new loan is enrolled correctly.
- Manual sweep reports zero failures.
- Repeated sweep creates no duplicate events.
- Ledger reconciliation displays **Matched**.
- Client authorizes automated scheduler activation.
