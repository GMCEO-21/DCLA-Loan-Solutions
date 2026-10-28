# Collections and Repayments Flow (Money-Safe Guide)

This is the focused guide for daily collections, approval posting, and reversals.

Use this document before changing any code under:
- `server/src/collections/*`
- `server/src/repayments/*`
- `server/src/loans/*`
- `client/src/features/collections/*`
- `client/src/features/repayments/*`

## 1. Plain-Language Version

Think of the system as three layers:

1. Cashier input layer
- Cashier enters payment or reversal request.
- These entries are pending and are not posted to balances yet.

2. Manager approval layer
- Manager approves/rejects the collection submission for a center and date.
- Approval is the gate that posts money effects.

3. Accounting projection layer
- After approval, member/day summaries and reports are updated.
- This layer is for dashboards, collection views, and exports.

In short:
- No manager approval = no real posting.
- Approved payment = balance goes down.
- Approved reversal = previously posted payment is undone.

## 2. Data Object Responsibilities

### 2.1 `repayment` table

Role:
- Financial event ledger for payment and reversal operations.

Why it exists:
- Keeps full event history with approval metadata.

Fields that matter most:
- `status`: pending/approved/rejected
- `operationType`: payment/reversal
- `relatedRepaymentId`: links reversal to original payment
- `batchId`: links row to manager approval batch

### 2.2 `collection_batch` table

Role:
- Approval container per `centerId + collectionDate`.

Why it exists:
- Manager approves one collection submission, not each row manually.

Fields that matter most:
- `status`: pending/approved/rejected
- `submittedById`, `approvedById`, `rejectedById`
- timestamps for submit/approve/reject

Constraint:
- Only one pending batch per center/date.

### 2.3 `collection` table

Role:
- Daily summary per member for display/reporting.

Why it exists:
- Fast and simple views for collection pages and exports.

Constraint:
- One row per member/center/date.

Important:
- This is not the authoritative event ledger.
- It is a projection/snapshot updated from approved repayment actions.

## 3. Step-by-Step Flows

### 3.1 Cashier posts a payment

API:
- `POST /api/repayments`

Outcome:
- New `repayment` row created as `pending`.
- Linked to pending batch (`collection_batch`) for center/date.
- No loan balance change yet.

### 3.2 Manager approves collection

API:
- `POST /api/repayments/pending/collections/approve`

Outcome:
- All pending repayment rows in that center/date group are processed.
- Each row is approved and applied to loan + schedule.
- `collection` summary row is inserted/updated per member/day.
- Batch status becomes `approved`.

### 3.3 Manager rejects collection

API:
- `POST /api/repayments/pending/collections/reject`

Outcome:
- Pending rows become `rejected`.
- Batch becomes `rejected`.
- No loan/schedule/balance posting occurs.

### 3.4 Cashier requests reversal

API:
- `POST /api/repayments/:id/reversal-request`

Rules:
- Source repayment must be approved.
- Source cannot already have pending/approved reversal.

Outcome:
- Pending reversal row created (`operationType = reversal`).
- Reversal row references original row in `relatedRepaymentId`.
- Grouped into pending batch.

### 3.5 Manager approves reversal

Outcome:
- Original allocation effects are rolled back from repayment schedules.
- Loan paid amounts/balance/weeks are recomputed.
- Savings used in original payment is credited back (if any).
- Collection summary row is decremented.
- Reversal row becomes approved.

## 4. Concrete Scenarios

## Scenario A: Normal payment posting

Given:
- Member weekly due: 1,000
- Cashier posts 1,000 on 2026-04-10

Before manager approval:
- Repayment row exists as pending
- Loan balance unchanged

After manager approval:
- Loan `amountPaid` +1,000
- Loan `balance` -1,000
- Schedule allocation created
- `collection.paymentReceived` for that member/date +1,000

## Scenario B: Reversal of approved payment

Given:
- Payment above was approved
- Cashier requests reversal

Before manager approval:
- Reversal row pending
- No rollback yet

After manager approval:
- Loan/schedule effects of original payment are rolled back
- Collection summary for member/date is reduced
- Reversal row approved

## Scenario C: Rejected collection

Given:
- Center has 20 pending entries
- Manager rejects batch with reason

Result:
- 20 repayment rows rejected
- Batch marked rejected
- No balance changes posted

## 5. Why This Design Is Cleaner Than Storing Everything in `collection`

If approval state is stored only in `collection` rows:
- Approval metadata is duplicated per member row.
- Manager action must update many rows for one decision.
- Audit trail becomes noisy and harder to reason about.
- Reversal linkage becomes harder to enforce.

With current design:
- `repayment`: event truth
- `collection_batch`: approval truth
- `collection`: reporting truth

This separation is the main reason the design scales.

## 6. Reconciliation Checks (Manual)

After release or migration, validate these:

1. No duplicate pending batches per center/date.
2. No duplicate `collection` rows per member/center/date.
3. Every approved reversal has a valid `relatedRepaymentId` pointing to a payment row.
4. Dashboard and transaction history exclude pending/rejected rows from posted totals.

## 7. Implementation Anchors (Files)

Core service:
- `server/src/repayments/repayments.service.ts`

Entities:
- `server/src/repayments/repayment.entity.ts`
- `server/src/repayments/entities/collection-batch.entity.ts`
- `server/src/collections/entities/collection.entity.ts`

Migrations:
- `server/src/migrations/1762000000000-AddRepaymentApprovalFields.ts`
- `server/src/migrations/1762100000000-AddRepaymentOperationFields.ts`
- `server/src/migrations/1762300000000-AddUniqueCollectionPerMemberCenterDate.ts`
- `server/src/migrations/1762500000000-CreateCollectionBatch.ts`

Frontend review/approval screens:
- `client/src/features/collections/components/CollectionDetailsModal.tsx`
- `client/src/features/repayments/pages/RepaymentApprovalsPage.tsx`

## 8. Non-Negotiable Rule

Any change that affects loan balances, repayment approvals, reversal logic, or collection totals must preserve auditability and deterministic rollback behavior.

For loans enrolled in `DCLA_2026_V1`, approval first catches up due charges and
then allocates money in this order: penalty, past-due interest, contractual loan
amount. Only the contractual portion updates collection received totals and the
repayment schedule. Charge payments and exact compensating reversals are stored
in `loan_charge_ledger` within the same approval transaction. Legacy loans have
`overdueChargePolicyVersion IS NULL` and retain the pre-DCLA-06 flow.

If a proposed change makes it harder to explain "who posted what, when, and why," it is not acceptable for production finance flow.
