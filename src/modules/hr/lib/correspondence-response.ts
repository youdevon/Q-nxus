import type {
  CorrespondenceCategory,
  CorrespondenceStatus,
  EmployeeCorrespondenceResponseStatus,
} from "@/generated/prisma/client";

/** Categories that enable employee response by default when issuing. */
export const RESPONSE_DEFAULT_CATEGORIES = new Set<CorrespondenceCategory>([
  "DISCIPLINARY",
  "WARNING",
  "PERFORMANCE",
]);

export const RESPONSE_BODY_MAX_LENGTH = 5000;

export function defaultAllowsEmployeeResponse(
  category: CorrespondenceCategory,
): boolean {
  return RESPONSE_DEFAULT_CATEGORIES.has(category);
}

export type CorrespondenceResponseEligibility = {
  status: CorrespondenceStatus;
  employeeVisible: boolean;
  allowsEmployeeResponse: boolean;
};

export type CorrespondenceResponseRecord = {
  status: EmployeeCorrespondenceResponseStatus;
};

/**
 * Employees may submit or update a response while the letter is issued (or
 * acknowledged), visible to them, and flagged to allow responses.
 */
export function canEmployeeSubmitCorrespondenceResponse(
  letter: CorrespondenceResponseEligibility,
  existing: CorrespondenceResponseRecord | null,
): boolean {
  if (!letter.allowsEmployeeResponse || !letter.employeeVisible) {
    return false;
  }

  if (letter.status !== "ISSUED" && letter.status !== "ACKNOWLEDGED") {
    return false;
  }

  if (!existing) {
    return true;
  }

  return existing.status === "OPEN";
}

export function canEmployeeUpdateCorrespondenceResponse(
  existing: CorrespondenceResponseRecord | null,
): boolean {
  return existing?.status === "OPEN";
}

export function canHrReviewCorrespondenceResponse(
  existing: CorrespondenceResponseRecord | null,
): boolean {
  return existing?.status === "OPEN";
}

export function canTransitionCorrespondenceResponseStatus(
  from: EmployeeCorrespondenceResponseStatus,
  to: EmployeeCorrespondenceResponseStatus,
): boolean {
  return from === "OPEN" && to === "REVIEWED";
}
