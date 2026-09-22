import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { redactIdentityFieldsInRecord } from "@/src/modules/hr/lib/redact-identity";

type AuditClient = Prisma.TransactionClient | typeof prisma;

export type RecordAuditEventInput = {
  userId?: string | null;
  organizationId?: string | null;
  moduleKey: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  description?: string | null;
  oldValues?: Prisma.InputJsonValue | null;
  newValues?: Prisma.InputJsonValue | null;
  correlationId?: string | null;
} & Partial<AuditRequestMetadata>;

function sanitizeAuditJson(
  value: Prisma.InputJsonValue | null | undefined,
): Prisma.InputJsonValue | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const redacted = redactIdentityFieldsInRecord(
    value as Record<string, unknown>,
  );
  return (redacted ?? undefined) as Prisma.InputJsonValue | undefined;
}

/**
 * Shared audit write path. Prefer this over inline `auditEvent.create`
 * so request metadata and field shapes stay consistent.
 * Automatically masks nisNumber / birNumber / idNumber in old/new JSON.
 */
export async function recordAuditEvent(
  db: AuditClient,
  input: RecordAuditEventInput,
): Promise<void> {
  await db.auditEvent.create({
    data: {
      userId: input.userId ?? null,
      organizationId: input.organizationId ?? null,
      moduleKey: input.moduleKey,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      description: input.description ?? null,
      oldValues: sanitizeAuditJson(input.oldValues),
      newValues: sanitizeAuditJson(input.newValues),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      clientHostName: input.clientHostName ?? null,
      correlationId: input.correlationId ?? null,
    },
  });
}
