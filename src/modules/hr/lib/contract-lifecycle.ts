import type { EmploymentContractStatus } from "@/generated/prisma/client";

export const CONTRACT_EDITABLE_STATUSES: EmploymentContractStatus[] = [
  "DRAFT",
];

export const CONTRACT_PRE_ACTIVE_STATUSES: EmploymentContractStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "AWAITING_SIGNATURE",
];

export function isContractEditable(
  status: EmploymentContractStatus | string,
): boolean {
  return status === "DRAFT";
}

export function canSubmitContract(
  status: EmploymentContractStatus | string,
): boolean {
  return status === "DRAFT";
}

export function canApproveContract(
  status: EmploymentContractStatus | string,
): boolean {
  return status === "PENDING_APPROVAL";
}

export function canSignContract(
  status: EmploymentContractStatus | string,
): boolean {
  return status === "APPROVED" || status === "AWAITING_SIGNATURE";
}

export function canActivateContract(
  status: EmploymentContractStatus | string,
): boolean {
  return (
    status === "APPROVED" ||
    status === "AWAITING_SIGNATURE" ||
    status === "DRAFT"
  );
}

/** First signature moves APPROVED → AWAITING_SIGNATURE; later signs stay there. */
export function statusAfterSignatureStarted(
  _status: EmploymentContractStatus | string,
): EmploymentContractStatus {
  return "AWAITING_SIGNATURE";
}

export function contractStatusLabel(
  status: EmploymentContractStatus | string,
): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "PENDING_APPROVAL":
      return "Pending approval";
    case "APPROVED":
      return "Approved";
    case "AWAITING_SIGNATURE":
      return "Awaiting signature";
    case "ACTIVE":
      return "Active";
    case "EXPIRED":
      return "Expired";
    case "SUPERSEDED":
      return "Superseded";
    case "TERMINATED":
      return "Terminated";
    case "CANCELLED":
      return "Cancelled";
    default:
      return String(status);
  }
}

export function bothSignaturesComplete(input: {
  employeeSignedAt: Date | string | null;
  orgSignedAt: Date | string | null;
  requireDualSignature: boolean;
}): boolean {
  if (!input.requireDualSignature) {
    return Boolean(input.employeeSignedAt || input.orgSignedAt);
  }

  return Boolean(input.employeeSignedAt && input.orgSignedAt);
}
