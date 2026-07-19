/** Audit module boundary — compliance trails and exportability. */
export const auditModule = {
  id: "audit",
  name: "Audit",
} as const;

export { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
export type { RecordAuditEventInput } from "@/src/modules/audit/services/record-audit-event";
