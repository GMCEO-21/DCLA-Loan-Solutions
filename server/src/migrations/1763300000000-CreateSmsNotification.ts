import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSmsNotification1763300000000 implements MigrationInterface {
  name = 'CreateSmsNotification1763300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "sms_notification_event_type_enum" AS ENUM (
        'loan_created',
        'repayment_posted'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "sms_notification_status_enum" AS ENUM (
        'pending',
        'processing',
        'sent',
        'failed'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "sms_notification" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "eventType" "sms_notification_event_type_enum" NOT NULL,
        "memberId" uuid,
        "loanId" uuid,
        "repaymentId" uuid,
        "requestedById" uuid,
        "recipient" character varying(32),
        "message" text NOT NULL,
        "status" "sms_notification_status_enum" NOT NULL DEFAULT 'pending',
        "provider" character varying(32) NOT NULL DEFAULT 'unisms',
        "providerMessageId" character varying(160),
        "idempotencyKey" character varying(160) NOT NULL,
        "attemptCount" integer NOT NULL DEFAULT 0,
        "lastErrorCode" character varying(80),
        "lastError" text,
        "nextAttemptAt" TIMESTAMP,
        "lockedAt" TIMESTAMP,
        "sentAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sms_notification_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sms_notification_member" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_sms_notification_loan" FOREIGN KEY ("loanId") REFERENCES "loan"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_sms_notification_repayment" FOREIGN KEY ("repaymentId") REFERENCES "repayment"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_sms_notification_requested_by" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_sms_notification_idempotency_key"
      ON "sms_notification" ("idempotencyKey")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sms_notification_worker"
      ON "sms_notification" ("status", "nextAttemptAt", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_sms_notification_worker"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_sms_notification_idempotency_key"`,
    );
    await queryRunner.query(`DROP TABLE "sms_notification"`);
    await queryRunner.query(`DROP TYPE "sms_notification_status_enum"`);
    await queryRunner.query(`DROP TYPE "sms_notification_event_type_enum"`);
  }
}
