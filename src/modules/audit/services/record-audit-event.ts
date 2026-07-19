import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditRequestMetadata } from "@/src/lib/audit-request-metadata";

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

/**
 * Shared audit write path. Prefer this over inline `auditEvent.create`
 * so request metadata and field shapes stay consistent.
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
      oldValues: input.oldValues ?? undefined,
      newValues: input.newValues ?? undefined,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      clientHostName: input.clientHostName ?? null,
      correlationId: input.correlationId ?? null,
    },
  });
}
