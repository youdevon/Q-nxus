export type CorrespondenceMergeContext = {
  employeeName: string;
  position: string;
  date: string;
  employeeNumber: string;
  nisNumber: string;
  birNumber: string;
};

const MERGE_PLACEHOLDERS = [
  "employeeName",
  "position",
  "date",
  "employeeNumber",
  "nisNumber",
  "birNumber",
] as const;

/**
 * Replaces `{{employeeName}}`, `{{position}}`, `{{date}}`,
 * `{{employeeNumber}}`, `{{nisNumber}}`, and `{{birNumber}}` in template
 * text. Unknown placeholders are left intact.
 */
export function applyCorrespondenceMergeFields(
  template: string,
  context: CorrespondenceMergeContext,
): string {
  let result = template;

  for (const key of MERGE_PLACEHOLDERS) {
    result = result.replaceAll(`{{${key}}}`, context[key]);
  }

  return result;
}

export function buildCorrespondenceMergeContext(input: {
  firstName: string;
  lastName: string;
  employeeNumber: string;
  positionTitle?: string | null;
  nisNumber?: string | null;
  birNumber?: string | null;
  effectiveDate?: Date;
}): CorrespondenceMergeContext {
  const effectiveDate = input.effectiveDate ?? new Date();
  const date = effectiveDate.toISOString().slice(0, 10);

  return {
    employeeName: `${input.firstName} ${input.lastName}`.trim(),
    position: input.positionTitle?.trim() || "—",
    date,
    employeeNumber: input.employeeNumber,
    nisNumber: input.nisNumber?.trim() || "—",
    birNumber: input.birNumber?.trim() || "—",
  };
}
