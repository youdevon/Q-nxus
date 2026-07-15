-- CreateEnum
CREATE TYPE "notifications"."EmailDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "notifications"."EmailPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "notifications"."email_deliveries" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT,
    "templateKey" TEXT,
    "moduleKey" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "recipientUserId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "subject" TEXT NOT NULL,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "priority" "notifications"."EmailPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "notifications"."EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maximumAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3),
    "processingStartedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastError" TEXT,
    "messageId" TEXT,
    "smtpResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications"."email_delivery_attempts" (
    "id" TEXT NOT NULL,
    "emailDeliveryId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "notifications"."EmailDeliveryStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "smtpResponse" TEXT,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications"."email_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subjectTemplate" TEXT NOT NULL,
    "textTemplate" TEXT,
    "htmlTemplate" TEXT,
    "moduleKey" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_deliveries_status_nextAttemptAt_idx" ON "notifications"."email_deliveries"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "email_deliveries_recipientUserId_idx" ON "notifications"."email_deliveries"("recipientUserId");

-- CreateIndex
CREATE INDEX "email_deliveries_recipientEmail_idx" ON "notifications"."email_deliveries"("recipientEmail");

-- CreateIndex
CREATE INDEX "email_deliveries_notificationId_idx" ON "notifications"."email_deliveries"("notificationId");

-- CreateIndex
CREATE INDEX "email_deliveries_moduleKey_idx" ON "notifications"."email_deliveries"("moduleKey");

-- CreateIndex
CREATE INDEX "email_deliveries_relatedType_relatedId_idx" ON "notifications"."email_deliveries"("relatedType", "relatedId");

-- CreateIndex
CREATE INDEX "email_deliveries_createdAt_idx" ON "notifications"."email_deliveries"("createdAt");

-- CreateIndex
CREATE INDEX "email_delivery_attempts_emailDeliveryId_idx" ON "notifications"."email_delivery_attempts"("emailDeliveryId");

-- CreateIndex
CREATE INDEX "email_delivery_attempts_status_idx" ON "notifications"."email_delivery_attempts"("status");

-- CreateIndex
CREATE INDEX "email_delivery_attempts_createdAt_idx" ON "notifications"."email_delivery_attempts"("createdAt");

-- CreateIndex
CREATE INDEX "email_templates_organizationId_idx" ON "notifications"."email_templates"("organizationId");

-- CreateIndex
CREATE INDEX "email_templates_moduleKey_idx" ON "notifications"."email_templates"("moduleKey");

-- CreateIndex
CREATE INDEX "email_templates_isActive_idx" ON "notifications"."email_templates"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_organizationId_key_key" ON "notifications"."email_templates"("organizationId", "key");

-- AddForeignKey
ALTER TABLE "notifications"."email_delivery_attempts" ADD CONSTRAINT "email_delivery_attempts_emailDeliveryId_fkey" FOREIGN KEY ("emailDeliveryId") REFERENCES "notifications"."email_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
