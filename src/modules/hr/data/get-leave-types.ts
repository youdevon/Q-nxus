import { prisma } from "@/lib/prisma";

export type LeaveTypeListRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  isPaid: boolean;
  requiresBalance: boolean;
  requiresDocument: boolean;
  documentRequiredAfter: string | null;
  minimumNoticeDays: number;
  maximumConsecutiveDays: string | null;
  allowsHalfDay: boolean;
  allowsNegativeBalance: boolean;
  carryForwardAllowed: boolean;
  carryForwardLimit: string | null;
  isSystem: boolean;
  isActive: boolean;
  entitlementRuleCount: number;
  employeeBalanceCount: number;
};

export async function getLeaveTypes(): Promise<LeaveTypeListRecord[]> {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  });

  if (!organization) {
    return [];
  }

  const leaveTypes = await prisma.leaveType.findMany({
    where: {
      organizationId: organization.id,
    },
    orderBy: [
      {
        sortOrder: "asc",
      },
      {
        name: "asc",
      },
    ],
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      unit: true,
      isPaid: true,
      requiresBalance: true,
      requiresDocument: true,
      documentRequiredAfter: true,
      minimumNoticeDays: true,
      maximumConsecutiveDays: true,
      allowsHalfDay: true,
      allowsNegativeBalance: true,
      carryForwardAllowed: true,
      carryForwardLimit: true,
      isSystem: true,
      isActive: true,
      _count: {
        select: {
          entitlementRules: true,
          balances: true,
        },
      },
    },
  });

  return leaveTypes.map((leaveType) => ({
    id: leaveType.id,
    code: leaveType.code,
    name: leaveType.name,
    description: leaveType.description,
    unit: leaveType.unit,
    isPaid: leaveType.isPaid,
    requiresBalance: leaveType.requiresBalance,
    requiresDocument: leaveType.requiresDocument,
    documentRequiredAfter: leaveType.documentRequiredAfter?.toString() ?? null,
    minimumNoticeDays: leaveType.minimumNoticeDays,
    maximumConsecutiveDays:
      leaveType.maximumConsecutiveDays?.toString() ?? null,
    allowsHalfDay: leaveType.allowsHalfDay,
    allowsNegativeBalance: leaveType.allowsNegativeBalance,
    carryForwardAllowed: leaveType.carryForwardAllowed,
    carryForwardLimit: leaveType.carryForwardLimit?.toString() ?? null,
    isSystem: leaveType.isSystem,
    isActive: leaveType.isActive,
    entitlementRuleCount: leaveType._count.entitlementRules,
    employeeBalanceCount: leaveType._count.balances,
  }));
}

export type LeaveTypeDetailRecord = LeaveTypeListRecord & {
  colour: string | null;
  sortOrder: number;
  updatedAt: string;
  entitlementRules: {
    id: string;
    name: string;
    employmentType: string | null;
    minimumServiceMonths: number;
    maximumServiceMonths: number | null;
    annualEntitlement: string;
    accrualMethod: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    priority: number;
    isActive: boolean;
  }[];
};

export async function getLeaveTypeDetail(
  leaveTypeId: string,
): Promise<LeaveTypeDetailRecord | null> {
  const leaveType = await prisma.leaveType.findUnique({
    where: { id: leaveTypeId },
    include: {
      entitlementRules: {
        orderBy: [{ priority: "desc" }, { effectiveFrom: "desc" }],
      },
      _count: {
        select: {
          entitlementRules: true,
          balances: true,
        },
      },
    },
  });

  if (!leaveType) {
    return null;
  }

  return {
    id: leaveType.id,
    code: leaveType.code,
    name: leaveType.name,
    description: leaveType.description,
    unit: leaveType.unit,
    isPaid: leaveType.isPaid,
    requiresBalance: leaveType.requiresBalance,
    requiresDocument: leaveType.requiresDocument,
    documentRequiredAfter: leaveType.documentRequiredAfter?.toString() ?? null,
    minimumNoticeDays: leaveType.minimumNoticeDays,
    maximumConsecutiveDays:
      leaveType.maximumConsecutiveDays?.toString() ?? null,
    allowsHalfDay: leaveType.allowsHalfDay,
    allowsNegativeBalance: leaveType.allowsNegativeBalance,
    carryForwardAllowed: leaveType.carryForwardAllowed,
    carryForwardLimit: leaveType.carryForwardLimit?.toString() ?? null,
    isSystem: leaveType.isSystem,
    isActive: leaveType.isActive,
    colour: leaveType.colour,
    sortOrder: leaveType.sortOrder,
    updatedAt: leaveType.updatedAt.toISOString(),
    entitlementRuleCount: leaveType._count.entitlementRules,
    employeeBalanceCount: leaveType._count.balances,
    entitlementRules: leaveType.entitlementRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      employmentType: rule.employmentType,
      minimumServiceMonths: rule.minimumServiceMonths,
      maximumServiceMonths: rule.maximumServiceMonths,
      annualEntitlement: rule.annualEntitlement.toString(),
      accrualMethod: rule.accrualMethod,
      effectiveFrom: rule.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: rule.effectiveTo?.toISOString().slice(0, 10) ?? null,
      priority: rule.priority,
      isActive: rule.isActive,
    })),
  };
}
