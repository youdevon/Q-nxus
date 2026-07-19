import { prisma } from "@/lib/prisma";
import { getExpiryStatus } from "@/src/modules/hr/lib/correspondence-visibility";
import { sortQualificationDocumentsByAuthority } from "@/src/modules/hr/lib/qualification-document-authority";

function formatDate(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.toISOString().slice(0, 10);
}

export type CredentialListItem = {
  id: string;
  name: string;
  issuer: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  employeeVisible: boolean;
  expiryStatus: "EXPIRED" | "EXPIRING" | "OK";
  hasAttachment: boolean;
  downloadHref: string | null;
};

export type TrainingListItem = {
  id: string;
  courseName: string;
  provider: string | null;
  completedAt: string;
  expiryDate: string | null;
  employeeVisible: boolean;
  expiryStatus: "EXPIRED" | "EXPIRING" | "OK";
  hasAttachment: boolean;
  downloadHref: string | null;
};

export type QualificationEntryListItem = {
  id: string;
  subjectOrName: string;
  gradeOrResult: string | null;
  level: string | null;
  sortOrder: number;
};

export type QualificationDocumentListItem = {
  id: string;
  title: string;
  documentType: string;
  qualificationSubtype: string | null;
  degreeType: string | null;
  customTypeLabel: string | null;
  programme: string | null;
  issuer: string | null;
  issueDate: string | null;
  year: number | null;
  employeeVisible: boolean;
  notes: string | null;
  hasAttachment: boolean;
  downloadHref: string | null;
  entries: QualificationEntryListItem[];
};

export type EmployeeFileExtras = {
  credentials: CredentialListItem[];
  trainingRecords: TrainingListItem[];
  qualifications: QualificationDocumentListItem[];
  expiringCredentialCount: number;
  expiringTrainingCount: number;
};

export async function getEmployeeFileExtras(
  employeeId: string,
  options?: { selfServiceOnly?: boolean },
): Promise<EmployeeFileExtras> {
  const visibilityFilter = options?.selfServiceOnly
    ? { employeeVisible: true }
    : {};

  const credentialWhere = {
    employeeId,
    ...visibilityFilter,
  };

  const trainingWhere = {
    employeeId,
    ...visibilityFilter,
  };

  const qualificationWhere = {
    employeeId,
    ...visibilityFilter,
  };

  const [credentials, trainingRecords, qualifications] = await Promise.all([
    prisma.employeeCredential.findMany({
      where: credentialWhere,
      orderBy: [{ expiryDate: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        issuer: true,
        issueDate: true,
        expiryDate: true,
        employeeVisible: true,
        storageKey: true,
      },
    }),
    prisma.employeeTrainingRecord.findMany({
      where: trainingWhere,
      orderBy: [{ completedAt: "desc" }],
      select: {
        id: true,
        courseName: true,
        provider: true,
        completedAt: true,
        expiryDate: true,
        employeeVisible: true,
        storageKey: true,
      },
    }),
    prisma.employeeQualificationDocument.findMany({
      where: qualificationWhere,
      orderBy: [{ title: "asc" }],
      select: {
        id: true,
        title: true,
        documentType: true,
        qualificationSubtype: true,
        degreeType: true,
        customTypeLabel: true,
        programme: true,
        issuer: true,
        issueDate: true,
        year: true,
        employeeVisible: true,
        notes: true,
        storageKey: true,
        entries: {
          orderBy: [{ sortOrder: "asc" }, { subjectOrName: "asc" }],
          select: {
            id: true,
            subjectOrName: true,
            gradeOrResult: true,
            level: true,
            sortOrder: true,
          },
        },
      },
    }),
  ]);

  const mappedCredentials: CredentialListItem[] = credentials.map((item) => {
    const expiryStatus = getExpiryStatus(item.expiryDate);
    return {
      id: item.id,
      name: item.name,
      issuer: item.issuer,
      issueDate: formatDate(item.issueDate),
      expiryDate: formatDate(item.expiryDate),
      employeeVisible: item.employeeVisible,
      expiryStatus,
      hasAttachment: Boolean(item.storageKey),
      downloadHref: item.storageKey
        ? `/people/employees/${employeeId}/credentials/${item.id}/attachment`
        : null,
    };
  });

  const mappedTraining: TrainingListItem[] = trainingRecords.map((item) => {
    const expiryStatus = getExpiryStatus(item.expiryDate);
    return {
      id: item.id,
      courseName: item.courseName,
      provider: item.provider,
      completedAt: formatDate(item.completedAt)!,
      expiryDate: formatDate(item.expiryDate),
      employeeVisible: item.employeeVisible,
      expiryStatus,
      hasAttachment: Boolean(item.storageKey),
      downloadHref: item.storageKey
        ? `/people/employees/${employeeId}/training/${item.id}/attachment`
        : null,
    };
  });

  const mappedQualifications: QualificationDocumentListItem[] =
    sortQualificationDocumentsByAuthority(
      qualifications.map((item) => ({
        id: item.id,
        title: item.title,
        documentType: item.documentType,
        qualificationSubtype: item.qualificationSubtype,
        degreeType: item.degreeType,
        customTypeLabel: item.customTypeLabel,
        programme: item.programme,
        issuer: item.issuer,
        issueDate: formatDate(item.issueDate),
        year: item.year,
        employeeVisible: item.employeeVisible,
        notes: options?.selfServiceOnly ? null : item.notes,
        hasAttachment: Boolean(item.storageKey),
        downloadHref: item.storageKey
          ? `/people/employees/${employeeId}/qualifications/${item.id}/file`
          : null,
        entries: item.entries,
      })),
    );

  return {
    credentials: mappedCredentials,
    trainingRecords: mappedTraining,
    qualifications: mappedQualifications,
    expiringCredentialCount: mappedCredentials.filter(
      (item) => item.expiryStatus === "EXPIRING" || item.expiryStatus === "EXPIRED",
    ).length,
    expiringTrainingCount: mappedTraining.filter(
      (item) => item.expiryStatus === "EXPIRING" || item.expiryStatus === "EXPIRED",
    ).length,
  };
}

export async function countExpiringEmployeeFileItems(
  employeeId: string,
): Promise<number> {
  const extras = await getEmployeeFileExtras(employeeId, {
    selfServiceOnly: true,
  });
  return extras.expiringCredentialCount + extras.expiringTrainingCount;
}
