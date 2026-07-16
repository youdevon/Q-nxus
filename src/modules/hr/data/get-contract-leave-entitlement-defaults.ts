import { prisma } from "@/lib/prisma";

/** Leave type codes shown on the employment contract form. */
export const CONTRACT_LEAVE_ENTITLEMENT_CODES = ["VAC", "SICK"] as const;

export type ContractLeaveEntitlementCode =
  (typeof CONTRACT_LEAVE_ENTITLEMENT_CODES)[number];

export type ContractLeaveEntitlementDefault = {
  leaveTypeCode: ContractLeaveEntitlementCode;
  leaveTypeName: string;
  annualEntitlement: string;
  prorateFirstYear: boolean;
};

/**
 * Active VAC / SICK entitlement rules for an employee’s org,
 * used to preview and prefill contract leave day fields.
 */
export async function getContractLeaveEntitlementDefaults(
  employeeId: string,
): Promise<ContractLeaveEntitlementDefault[]> {
  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      organizationId: true,
      employmentType: true,
    },
  });

  if (!employee) {
    return [];
  }

  const leaveTypes = await prisma.leaveType.findMany({
    where: {
      organizationId: employee.organizationId,
      isActive: true,
      requiresBalance: true,
      code: {
        in: [...CONTRACT_LEAVE_ENTITLEMENT_CODES],
      },
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  if (leaveTypes.length === 0) {
    return [];
  }

  const now = new Date();
  const defaults: ContractLeaveEntitlementDefault[] = [];

  for (const leaveType of leaveTypes) {
    const rule = await prisma.leaveEntitlementRule.findFirst({
      where: {
        organizationId: employee.organizationId,
        leaveTypeId: leaveType.id,
        isActive: true,
        AND: [
          {
            OR: [
              {
                employmentType: null,
              },
              {
                employmentType: employee.employmentType,
              },
            ],
          },
          {
            effectiveFrom: {
              lte: now,
            },
          },
          {
            OR: [
              {
                effectiveTo: null,
              },
              {
                effectiveTo: {
                  gte: now,
                },
              },
            ],
          },
        ],
      },
      orderBy: [
        {
          priority: "desc",
        },
        {
          minimumServiceMonths: "desc",
        },
      ],
      select: {
        annualEntitlement: true,
        prorateFirstYear: true,
      },
    });

    if (!rule) {
      continue;
    }

    const code = leaveType.code as ContractLeaveEntitlementCode;

    defaults.push({
      leaveTypeCode: code,
      leaveTypeName: leaveType.name,
      annualEntitlement: rule.annualEntitlement.toString(),
      prorateFirstYear: rule.prorateFirstYear,
    });
  }

  return defaults;
}
