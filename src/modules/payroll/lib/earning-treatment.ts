export type PayrollTaxTreatmentCode =
  | "TAXABLE_EMPLOYMENT"
  | "NON_TAXABLE"
  | "NIS_ONLY"
  | "PAYE_EXEMPT";

/** Aligns with org component defs: only TAXABLE_EMPLOYMENT is PAYE-taxable. */
export function isTaxableFromTreatment(
  taxTreatment: PayrollTaxTreatmentCode,
): boolean {
  return taxTreatment === "TAXABLE_EMPLOYMENT";
}
