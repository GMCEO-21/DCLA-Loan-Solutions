# Repayment Schedule Repair Guide

This guide is for the one-time repair of historical loan repayment schedules where:

- `loan.amountPaid` is correct
- approved `repayment` rows exist
- `loan_repayment_schedule` still shows `unpaid` or incomplete paid amounts
- `loan_repayment_allocation` is missing or incomplete for older repayments

## Purpose

The repair command replays approved repayments back into repayment schedules and allocation rows.

It is intended for historical data repair, especially after restoring production data into a test database first.

## Preconditions

Before running the repair:

- Back up the target database first.
- Prefer testing on a restored production dump before production.
- Keep automatic schema changes off:

```env
TYPEORM_SYNC=false
TYPEORM_RUN_MIGRATIONS=false
```

- Make sure the backend builds successfully.

## Command

Run from `server/`:

```bash
npm run repair:repayment-schedules
```

The command will:

- scan all loans
- create missing schedule rows if needed
- delete existing allocation rows for each loan schedule
- reset schedule paid amounts/statuses
- replay approved repayments into schedule allocations
- print progress and a final summary

## What It Fixes

This repair addresses cases where:

- a loan is already `paid`
- repayments are approved
- but the schedule is still short or shows `unpaid`

It is especially useful when approved repayments exist without matching allocation rows.

## What It Does Not Do

The repair does not:

- create new repayments
- invent payment amounts
- mark unpaid loans as paid unless the existing approved repayments already justify that

It only rebuilds schedule state from existing approved repayment data.

## Verification Queries

### 1. Remaining paid-loan schedule mismatches

```sql
SELECT COUNT(*) AS remaining_mismatches
FROM (
  SELECT l.id
  FROM loan l
  LEFT JOIN loan_repayment_schedule s
    ON s."loanId" = l.id
  GROUP BY l.id, l.status, l."totalAmount", l."amountPaid"
  HAVING l.status = 'paid'
     AND l."amountPaid" >= l."totalAmount"
     AND COALESCE(SUM(s."amountPaid"), 0) < COALESCE(SUM(s."amountDue"), 0)
) x;
```

### 2. List remaining mismatched paid loans

```sql
SELECT
  l.id AS "loanId",
  l."borrowerId",
  l.status,
  l."totalAmount",
  l."amountPaid",
  COALESCE(SUM(s."amountDue"), 0) AS "scheduleDue",
  COALESCE(SUM(s."amountPaid"), 0) AS "schedulePaid"
FROM loan l
LEFT JOIN loan_repayment_schedule s
  ON s."loanId" = l.id
GROUP BY l.id, l."borrowerId", l.status, l."totalAmount", l."amountPaid", l."createdAt"
HAVING l.status = 'paid'
   AND l."amountPaid" >= l."totalAmount"
   AND COALESCE(SUM(s."amountPaid"), 0) < COALESCE(SUM(s."amountDue"), 0)
ORDER BY l."createdAt" DESC;
```

### 3. Approved repayments with no allocation rows

```sql
SELECT COUNT(*) AS orphan_approved_repayments
FROM (
  SELECT r.id
  FROM repayment r
  LEFT JOIN loan_repayment_allocation a
    ON a."repaymentId" = r.id
  WHERE r.status = 'approved'
    AND r."operationType" = 'payment'
  GROUP BY r.id
  HAVING COUNT(a."scheduleId") = 0
) x;
```

## Spot Check Example

To inspect one repaired loan:

```sql
SELECT "weekNumber", "dueDate", "amountDue", "amountPaid", status
FROM loan_repayment_schedule
WHERE "loanId" = '<loan-id>'
ORDER BY "weekNumber";
```

## Notes

- Some remaining small mismatches can still come from schedule-generation rounding, not missing allocations.
- Completed loans are normalized to display `PAID` instead of `ADVANCE` in the schedule response.
- This repair is safe to run on test first, then production, as long as a backup exists and results are verified.
