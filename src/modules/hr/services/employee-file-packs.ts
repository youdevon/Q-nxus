import type {
  EmployeeFileChecklistItemType,
  EmploymentContractType,
  WorkforceCategory,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_PACK_ITEMS: Array<{
  itemType: EmployeeFileChecklistItemType;
  required: boolean;
  sortOrder: number;
}> = [
  { itemType: "ACADEMIC_CERTIFICATES", required: true, sortOrder: 10 },
  { itemType: "COPY_OF_ID", required: true, sortOrder: 20 },
  { itemType: "BIRTH_CERTIFICATE", required: true, sortOrder: 30 },
  { itemType: "MARRIAGE_CERTIFICATE", required: false, sortOrder: 40 },
  { itemType: "ASSUMPTION_OF_DUTY", required: true, sortOrder: 50 },
];

/** Ensure a default employee-file pack exists for the organization. */
export async function ensureDefaultEmployeeFilePack(organizationId: string) {
  const existing = await prisma.employeeFilePack.findFirst({
    where: {
      organizationId,
      code: "DEFAULT",
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.employeeFilePack.create({
    data: {
      organizationId,
      code: "DEFAULT",
      name: "Standard employee file",
      description: "Default Caribbean onboarding document pack.",
      isDefault: true,
      isActive: true,
      items: {
        create: DEFAULT_PACK_ITEMS.map((item) => ({
          itemType: item.itemType,
          required: item.required,
          sortOrder: item.sortOrder,
        })),
      },
    },
    select: { id: true },
  });
}

export async function resolveEmployeeFilePack(input: {
  organizationId: string;
  workforceCategory?: WorkforceCategory | null;
  contractType?: EmploymentContractType | null;
}) {
  await ensureDefaultEmployeeFilePack(input.organizationId);

  const packs = await prisma.employeeFilePack.findMany({
    where: {
      organizationId: input.organizationId,
      isActive: true,
    },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  const matched =
    packs.find(
      (pack) =>
        pack.workforceCategory === input.workforceCategory &&
        pack.contractType === input.contractType,
    ) ??
    packs.find((pack) => pack.workforceCategory === input.workforceCategory) ??
    packs.find((pack) => pack.contractType === input.contractType) ??
    packs.find((pack) => pack.isDefault) ??
    packs[0] ??
    null;

  return matched;
}

export async function seedChecklistFromPack(input: {
  organizationId: string;
  employeeId: string;
  workforceCategory?: WorkforceCategory | null;
  contractType?: EmploymentContractType | null;
}) {
  const pack = await resolveEmployeeFilePack(input);

  if (!pack) {
    return { created: 0 };
  }

  let created = 0;

  for (const item of pack.items) {
    const result = await prisma.employeeFileChecklistItem.upsert({
      where: {
        employeeId_itemType: {
          employeeId: input.employeeId,
          itemType: item.itemType,
        },
      },
      update: {},
      create: {
        organizationId: input.organizationId,
        employeeId: input.employeeId,
        itemType: item.itemType,
        notApplicable: !item.required && item.itemType === "MARRIAGE_CERTIFICATE",
      },
      select: { id: true },
    });

    if (result) {
      created += 1;
    }
  }

  return { created, packId: pack.id };
}
