export type LeaveEntitlementOverride = {
  leaveTypeCode: string;
  entitlementDays: number;
};

type DecimalLike = { toString(): string } | number | string;

/**
 * Build VAC/SICK entitlement overrides from contract columns.
 * `null` means “use org entitlement rules”; `0` means explicitly no days.
 */
export function entitlementOverridesFromContractFields(input: {
  vacationLeaveDaysOverride: DecimalLike | null | undefined;
  sickLeaveDaysOverride: DecimalLike | null | undefined;
}): LeaveEntitlementOverride[] {
  const overrides: LeaveEntitlementOverride[] = [];

  if (input.vacationLeaveDaysOverride != null) {
    overrides.push({
      leaveTypeCode: "VAC",
      entitlementDays: Number(input.vacationLeaveDaysOverride),
    });
  }

  if (input.sickLeaveDaysOverride != null) {
    overrides.push({
      leaveTypeCode: "SICK",
      entitlementDays: Number(input.sickLeaveDaysOverride),
    });
  }

  return overrides;
}

export function formatLeaveOverrideDays(
  value: DecimalLike | null | undefined,
): string {
  if (value == null) {
    return "";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "";
  }

  if (Number.isInteger(number)) {
    return String(number);
  }

  return String(Number(number.toFixed(2)));
}
