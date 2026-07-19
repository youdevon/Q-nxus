import { prisma } from "@/lib/prisma";
import {
  daysUntilExpiry,
  getExpiryStatus,
  type ExpiryDashboardWindow,
} from "@/src/modules/hr/lib/correspondence-visibility";

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export type ExpiringFileItem = {
  kind: "credential" | "training";
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  label: string;
  issuerOrProvider: string | null;
  expiryDate: string;
  daysUntil: number;
  status: "EXPIRED" | "EXPIRING";
  fileHref: string;
};

export type ExpiringFilesDashboard = {
  windowDays: ExpiryDashboardWindow;
  expiring: ExpiringFileItem[];
  expired: ExpiringFileItem[];
};

/**
 * Org-wide credentials and training records expiring within the window,
 * plus already-expired items. Qualification documents have no expiry field
 * and are omitted.
 */
export async function getExpiringEmployeeFileItems(input: {
  organizationId: string;
  windowDays: ExpiryDashboardWindow;
  asOf?: Date;
}): Promise<ExpiringFilesDashboard> {
  const asOf = input.asOf ?? new Date();
  const windowEnd = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
  );
  windowEnd.setUTCDate(windowEnd.getUTCDate() + input.windowDays);

  const [credentials, training] = await Promise.all([
    prisma.employeeCredential.findMany({
      where: {
        organizationId: input.organizationId,
        expiryDate: { not: null, lte: windowEnd },
        employee: {
          isArchived: false,
          employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] },
        },
      },
      orderBy: [{ expiryDate: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        issuer: true,
        expiryDate: true,
        employeeId: true,
        employee: {
          select: {
            employeeNumber: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.employeeTrainingRecord.findMany({
      where: {
        organizationId: input.organizationId,
        expiryDate: { not: null, lte: windowEnd },
        employee: {
          isArchived: false,
          employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] },
        },
      },
      orderBy: [{ expiryDate: "asc" }, { courseName: "asc" }],
      select: {
        id: true,
        courseName: true,
        provider: true,
        expiryDate: true,
        employeeId: true,
        employee: {
          select: {
            employeeNumber: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
  ]);

  const items: ExpiringFileItem[] = [];

  for (const credential of credentials) {
    if (!credential.expiryDate) {
      continue;
    }

    const status = getExpiryStatus(
      credential.expiryDate,
      asOf,
      input.windowDays,
    );
    if (status === "OK") {
      continue;
    }

    items.push({
      kind: "credential",
      id: credential.id,
      employeeId: credential.employeeId,
      employeeNumber: credential.employee.employeeNumber,
      employeeName: `${credential.employee.firstName} ${credential.employee.lastName}`,
      label: credential.name,
      issuerOrProvider: credential.issuer,
      expiryDate: formatDate(credential.expiryDate),
      daysUntil: daysUntilExpiry(credential.expiryDate, asOf) ?? 0,
      status,
      fileHref: `/people/employees/${credential.employeeId}/documents`,
    });
  }

  for (const record of training) {
    if (!record.expiryDate) {
      continue;
    }

    const status = getExpiryStatus(record.expiryDate, asOf, input.windowDays);
    if (status === "OK") {
      continue;
    }

    items.push({
      kind: "training",
      id: record.id,
      employeeId: record.employeeId,
      employeeNumber: record.employee.employeeNumber,
      employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
      label: record.courseName,
      issuerOrProvider: record.provider,
      expiryDate: formatDate(record.expiryDate),
      daysUntil: daysUntilExpiry(record.expiryDate, asOf) ?? 0,
      status,
      fileHref: `/people/employees/${record.employeeId}/documents`,
    });
  }

  items.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  return {
    windowDays: input.windowDays,
    expiring: items.filter((item) => item.status === "EXPIRING"),
    expired: items.filter((item) => item.status === "EXPIRED"),
  };
}
