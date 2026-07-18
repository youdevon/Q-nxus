/**
 * Period-over-period variance helpers for draft/posted pay-run review (Wave B).
 */

import { moneyDiffCents, roundToCents } from "@/src/modules/payroll/lib/money";

export type PayVarianceThresholds = {
  /** Absolute net change (currency units) that requires an explanation. */
  netAbsolute: number;
  /** Relative net change (0.1 = 10%) that requires an explanation. */
  netRelative: number;
};

export const DEFAULT_PAY_VARIANCE_THRESHOLDS: PayVarianceThresholds = {
  netAbsolute: 500,
  netRelative: 0.1,
};

export type PayVarianceFlag = {
  employeeId: string;
  employeeName: string;
  priorNet: number;
  currentNet: number;
  deltaNet: number;
  reason: "NEW" | "ABSOLUTE" | "RELATIVE" | "WITHIN_THRESHOLD";
  requiresExplanation: boolean;
};

export function evaluateNetPayVariance(input: {
  employeeId: string;
  employeeName: string;
  priorNet: number | null;
  currentNet: number;
  thresholds?: PayVarianceThresholds;
}): PayVarianceFlag {
  const thresholds = input.thresholds ?? DEFAULT_PAY_VARIANCE_THRESHOLDS;
  const currentNet = roundToCents(input.currentNet);

  if (input.priorNet == null) {
    return {
      employeeId: input.employeeId,
      employeeName: input.employeeName,
      priorNet: 0,
      currentNet,
      deltaNet: currentNet,
      reason: "NEW",
      requiresExplanation: currentNet !== 0,
    };
  }

  const priorNet = roundToCents(input.priorNet);
  const deltaNet = roundToCents(currentNet - priorNet);
  const absDelta = Math.abs(deltaNet);
  const relative =
    priorNet === 0 ? (currentNet === 0 ? 0 : 1) : absDelta / Math.abs(priorNet);

  if (absDelta >= thresholds.netAbsolute) {
    return {
      employeeId: input.employeeId,
      employeeName: input.employeeName,
      priorNet,
      currentNet,
      deltaNet,
      reason: "ABSOLUTE",
      requiresExplanation: true,
    };
  }

  if (relative >= thresholds.netRelative && moneyDiffCents(absDelta, 0) !== 0) {
    return {
      employeeId: input.employeeId,
      employeeName: input.employeeName,
      priorNet,
      currentNet,
      deltaNet,
      reason: "RELATIVE",
      requiresExplanation: true,
    };
  }

  return {
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    priorNet,
    currentNet,
    deltaNet,
    reason: "WITHIN_THRESHOLD",
    requiresExplanation: false,
  };
}
