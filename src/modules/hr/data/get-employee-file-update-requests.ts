import { prisma } from "@/lib/prisma";

function formatDateTime(value: Date): string {
  return value.toISOString();
}

export type EmployeeFileUpdateRequestItem = {
  id: string;
  title: string;
  note: string | null;
  status: "OPEN" | "RESOLVED";
  requestType: string;
  createdAt: string;
  resolvedAt: string | null;
  requestedByName: string | null;
  resolvedByName: string | null;
};

export async function getEmployeeFileUpdateRequests(
  employeeId: string,
  options?: { openOnly?: boolean },
): Promise<EmployeeFileUpdateRequestItem[]> {
  const rows = await prisma.employeeFileUpdateRequest.findMany({
    where: {
      employeeId,
      ...(options?.openOnly ? { status: "OPEN" } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      note: true,
      status: true,
      requestType: true,
      createdAt: true,
      resolvedAt: true,
      requestedBy: { select: { firstName: true, lastName: true } },
      resolvedBy: { select: { firstName: true, lastName: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    note: row.note,
    status: row.status,
    requestType: row.requestType,
    createdAt: formatDateTime(row.createdAt),
    resolvedAt: row.resolvedAt ? formatDateTime(row.resolvedAt) : null,
    requestedByName: row.requestedBy
      ? `${row.requestedBy.firstName} ${row.requestedBy.lastName}`
      : null,
    resolvedByName: row.resolvedBy
      ? `${row.resolvedBy.firstName} ${row.resolvedBy.lastName}`
      : null,
  }));
}
