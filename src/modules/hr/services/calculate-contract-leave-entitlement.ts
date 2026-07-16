import { Prisma } from "@/generated/prisma/client";
import { calculateContractLeaveEntitlementDays } from "@/src/modules/hr/lib/contract-leave-entitlement";

export { calculateContractLeaveEntitlementDays } from "@/src/modules/hr/lib/contract-leave-entitlement";

export function calculateContractLeaveEntitlement({
  annualEntitlement,
  contractStart,
  contractEnd,
  prorate,
}: {
  annualEntitlement: Prisma.Decimal | number | string;
  contractStart: Date;
  contractEnd: Date;
  prorate: boolean;
}): Prisma.Decimal {
  return new Prisma.Decimal(
    calculateContractLeaveEntitlementDays({
      annualEntitlement: Number(annualEntitlement),
      contractStart,
      contractEnd,
      prorate,
    }),
  );
}
