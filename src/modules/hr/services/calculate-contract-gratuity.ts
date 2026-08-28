/**
 * @deprecated Import from `@/src/modules/payroll/lib/calculate-gratuity`.
 * Re-exports kept for HR leave entitlement + legacy contract form callers.
 */
export {
  calculateContractGratuity,
  calculateContractGratuityEstimate,
  calculateGratuityTax,
  inclusiveContractMonths,
  monthlyEligibleEarnings,
  roundMoney,
  TT_DEFAULT_GRATUITY_TAX_BANDS,
  type ContractGratuityEstimate,
  type GratuityAllowanceInput,
  type GratuityFormulaKind,
  type GratuityPolicyInput,
  type GratuityTaxBandInput,
  type GratuityTaxMode,
} from "@/src/modules/payroll/lib/calculate-gratuity";
