"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  QualificationDegreeType,
  QualificationDocumentType,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  deriveQualificationDocumentTitle,
  normalizeCxcGrade,
  QUALIFICATION_DEGREE_TYPE_OPTIONS,
  qualificationNeedsCustomTypeLabel,
  qualificationSubtypeOptionsFor,
  qualificationSubtypeRequired,
  qualificationUsesSubjectEntries,
  usesCxcGradeSelect,
} from "@/src/modules/hr/lib/qualification-document-labels";
import {
  deleteEmployeeFileAttachment,
  storeEmployeeFileAttachment,
} from "@/src/modules/hr/lib/store-employee-file-attachment";

export type QualificationFormState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Record<string, string>;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function parseDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function checkboxValue(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

function parseYear(value: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
    return null;
  }

  return parsed;
}

type QualificationEntryInput = {
  subjectOrName: string;
  gradeOrResult: string | null;
  level: string | null;
  sortOrder: number;
};

function parseEntries(formData: FormData): QualificationEntryInput[] {
  const rowIds = formData
    .getAll("entryRowIds")
    .filter((value): value is string => typeof value === "string");

  const entries: QualificationEntryInput[] = [];

  for (const [index, rowId] of rowIds.entries()) {
    const subjectOrName = textValue(formData, `entrySubject:${rowId}`);

    if (!subjectOrName) {
      continue;
    }

    const sortOrderRaw = Number(
      textValue(formData, `entrySortOrder:${rowId}`) || String(index),
    );

    entries.push({
      subjectOrName,
      gradeOrResult: nullableText(formData, `entryGrade:${rowId}`),
      level: nullableText(formData, `entryLevel:${rowId}`),
      sortOrder: Number.isInteger(sortOrderRaw) ? sortOrderRaw : index,
    });
  }

  return entries;
}

function parseDocumentType(value: string): QualificationDocumentType | null {
  if (
    Object.values(QualificationDocumentType).includes(
      value as QualificationDocumentType,
    )
  ) {
    return value as QualificationDocumentType;
  }

  return null;
}

function parseDegreeType(value: string): QualificationDegreeType | null {
  if (
    Object.values(QualificationDegreeType).includes(
      value as QualificationDegreeType,
    )
  ) {
    return value as QualificationDegreeType;
  }

  // Also accept known option values in case enum client is stale mid-migrate
  if (
    QUALIFICATION_DEGREE_TYPE_OPTIONS.some((option) => option.value === value)
  ) {
    return value as QualificationDegreeType;
  }

  return null;
}

type ParsedQualificationFields = {
  title: string;
  documentType: QualificationDocumentType | null;
  qualificationSubtype: string | null;
  degreeType: QualificationDegreeType | null;
  customTypeLabel: string | null;
  programme: string | null;
  issuer: string | null;
  issueDate: Date | null;
  yearRaw: string;
  year: number | null;
  employeeVisible: boolean;
  notes: string | null;
  entries: QualificationEntryInput[];
  fieldErrors: Record<string, string>;
};

function parseQualificationSubtype(
  documentType: QualificationDocumentType | null,
  raw: string,
): string | null {
  if (!documentType || !raw) {
    return null;
  }

  const options = qualificationSubtypeOptionsFor(documentType);
  if (options.length === 0) {
    return null;
  }

  const match = options.find((option) => option.value === raw);
  return match?.value ?? null;
}

function parseQualificationFormFields(
  formData: FormData,
): ParsedQualificationFields {
  const documentType = parseDocumentType(textValue(formData, "documentType"));
  const subtypeRaw = textValue(formData, "qualificationSubtype");
  const degreeTypeRaw = textValue(formData, "degreeType");
  const customTypeLabelRaw = textValue(formData, "customTypeLabel");
  const programmeRaw = textValue(formData, "programme");
  const issuer = nullableText(formData, "issuer");
  const issueDate = parseDate(textValue(formData, "issueDate"));
  const yearRaw = textValue(formData, "year");
  const year = parseYear(yearRaw);
  const employeeVisible = checkboxValue(formData, "employeeVisible");
  const notes = nullableText(formData, "notes");
  const usesSubjectEntries = qualificationUsesSubjectEntries(
    documentType ?? "",
  );
  const entries = usesSubjectEntries ? parseEntries(formData) : [];

  const fieldErrors: Record<string, string> = {};

  if (!documentType) {
    fieldErrors.documentType = "Select a category.";
  }

  const subtypeOptions = documentType
    ? qualificationSubtypeOptionsFor(documentType)
    : [];
  let qualificationSubtype: string | null = null;

  if (subtypeOptions.length > 0 && subtypeRaw) {
    qualificationSubtype = parseQualificationSubtype(documentType, subtypeRaw);
    if (!qualificationSubtype) {
      fieldErrors.qualificationSubtype = "Select a valid subtype.";
    }
  } else if (
    documentType &&
    qualificationSubtypeRequired(documentType) &&
    subtypeOptions.length > 0
  ) {
    fieldErrors.qualificationSubtype = "Select a subtype.";
  }

  let degreeType: QualificationDegreeType | null = null;
  let customTypeLabel: string | null = null;
  let programme: string | null = null;

  if (documentType === QualificationDocumentType.UNIVERSITY) {
    degreeType = parseDegreeType(degreeTypeRaw);
    if (!degreeType) {
      fieldErrors.degreeType = "Select a degree type.";
    }
    programme = programmeRaw.length > 0 ? programmeRaw : null;
  }

  if (
    documentType &&
    qualificationNeedsCustomTypeLabel({
      documentType,
      qualificationSubtype,
      degreeType,
    })
  ) {
    if (customTypeLabelRaw.length < 2) {
      fieldErrors.customTypeLabel = "Enter a type name.";
    } else {
      customTypeLabel = customTypeLabelRaw;
    }
  }

  if (yearRaw && year === null) {
    fieldErrors.year = "Enter a valid year between 1900 and 2100.";
  }

  if (usesSubjectEntries && entries.length === 0) {
    fieldErrors.entries = "Add at least one subject or qualification line.";
  }

  const normalizeGrades = usesCxcGradeSelect({
    documentType: documentType ?? "",
    qualificationSubtype,
  });

  if (normalizeGrades && !fieldErrors.entries) {
    const missingGrade = entries.some(
      (entry) => entry.subjectOrName && !entry.gradeOrResult,
    );
    if (missingGrade) {
      fieldErrors.entries = "Select a grade for each subject.";
    }
  }

  const normalizedEntries = normalizeGrades
    ? entries.map((entry) => ({
        ...entry,
        gradeOrResult: entry.gradeOrResult
          ? (normalizeCxcGrade(entry.gradeOrResult) ?? entry.gradeOrResult)
          : null,
      }))
    : entries;

  const title = documentType
    ? deriveQualificationDocumentTitle({
        documentType,
        qualificationSubtype,
        customTypeLabel,
        degreeType,
      })
    : "";

  return {
    title,
    documentType,
    qualificationSubtype,
    degreeType,
    customTypeLabel,
    programme,
    issuer,
    issueDate,
    yearRaw,
    year,
    employeeVisible,
    notes,
    entries: normalizedEntries,
    fieldErrors,
  };
}

function revalidateQualificationPaths(employeeId: string) {
  revalidatePath(`/people/employees/${employeeId}/documents`);
  revalidatePath("/me/documents");
  revalidatePath("/me/qualifications");
  revalidatePath("/me");
}

export async function createEmployeeQualificationDocument(
  _previousState: QualificationFormState,
  formData: FormData,
): Promise<QualificationFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const employeeId = textValue(formData, "employeeId");
  const {
    title,
    documentType,
    qualificationSubtype,
    degreeType,
    customTypeLabel,
    programme,
    issuer,
    issueDate,
    year,
    employeeVisible,
    notes,
    entries,
    fieldErrors,
  } = parseQualificationFormFields(formData);

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the qualification details.",
      fieldErrors,
    };
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, organizationId: true, firstName: true, lastName: true },
  });

  if (!employee) {
    return { status: "error", message: "Employee not found." };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const attachmentEntry = formData.get("attachment");
  const attachmentFile =
    attachmentEntry instanceof File && attachmentEntry.size > 0
      ? attachmentEntry
      : null;

  try {
    await prisma.$transaction(async (transaction) => {
      const created = await transaction.employeeQualificationDocument.create({
        data: {
          organizationId: employee.organizationId,
          employeeId: employee.id,
          title,
          documentType: documentType!,
          qualificationSubtype,
          degreeType,
          customTypeLabel,
          programme,
          issuer,
          issueDate,
          year,
          employeeVisible,
          notes,
          entries: {
            create: entries,
          },
        },
        select: { id: true },
      });

      if (attachmentFile) {
        const stored = await storeEmployeeFileAttachment({
          recordType: "qualifications",
          recordId: created.id,
          file: attachmentFile,
        });

        await transaction.employeeQualificationDocument.update({
          where: { id: created.id },
          data: {
            fileName: stored.fileName,
            storageKey: stored.storageKey,
            mimeType: stored.mimeType,
            fileSize: stored.fileSize,
          },
        });
      }

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "CREATE",
          entityType: "EmployeeQualificationDocument",
          entityId: created.id,
          description: `Added qualification “${title}” for ${employee.firstName} ${employee.lastName}`,
          newValues: {
            title,
            documentType,
            qualificationSubtype,
            degreeType,
            customTypeLabel,
            programme,
            entryCount: entries.length,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to save the qualification document.";
    return { status: "error", message };
  }

  revalidateQualificationPaths(employee.id);

  const intent = textValue(formData, "intent");
  if (intent === "addAnother") {
    return {
      status: "success",
      message: "Qualification saved. Add another below.",
    };
  }

  redirect(`/people/employees/${employee.id}/documents`);
}

export async function updateEmployeeQualificationDocument(
  _previousState: QualificationFormState,
  formData: FormData,
): Promise<QualificationFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const employeeId = textValue(formData, "employeeId");
  const documentId = textValue(formData, "documentId");
  const {
    title,
    documentType,
    qualificationSubtype,
    degreeType,
    customTypeLabel,
    programme,
    issuer,
    issueDate,
    year,
    employeeVisible,
    notes,
    entries,
    fieldErrors,
  } = parseQualificationFormFields(formData);

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the qualification details.",
      fieldErrors,
    };
  }

  const existing = await prisma.employeeQualificationDocument.findFirst({
    where: { id: documentId, employeeId },
    select: {
      id: true,
      title: true,
      storageKey: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
    },
  });

  if (!existing) {
    return { status: "error", message: "Qualification document not found." };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const attachmentEntry = formData.get("attachment");
  const attachmentFile =
    attachmentEntry instanceof File && attachmentEntry.size > 0
      ? attachmentEntry
      : null;
  const removeAttachment = checkboxValue(formData, "removeAttachment");

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.employeeQualificationEntry.deleteMany({
        where: { documentId: existing.id },
      });

      await transaction.employeeQualificationDocument.update({
        where: { id: existing.id },
        data: {
          title,
          documentType: documentType!,
          qualificationSubtype,
          degreeType,
          customTypeLabel,
          programme,
          issuer,
          issueDate,
          year,
          employeeVisible,
          notes,
          entries: {
            create: entries,
          },
        },
      });

      if (attachmentFile) {
        const stored = await storeEmployeeFileAttachment({
          recordType: "qualifications",
          recordId: existing.id,
          file: attachmentFile,
        });

        await transaction.employeeQualificationDocument.update({
          where: { id: existing.id },
          data: {
            fileName: stored.fileName,
            storageKey: stored.storageKey,
            mimeType: stored.mimeType,
            fileSize: stored.fileSize,
          },
        });
      } else if (removeAttachment && existing.storageKey) {
        await transaction.employeeQualificationDocument.update({
          where: { id: existing.id },
          data: {
            fileName: null,
            storageKey: null,
            mimeType: null,
            fileSize: null,
          },
        });
      }

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "UPDATE",
          entityType: "EmployeeQualificationDocument",
          entityId: existing.id,
          description: `Updated qualification “${title}”`,
          oldValues: { title: existing.title },
          newValues: {
            title,
            documentType,
            qualificationSubtype,
            degreeType,
            customTypeLabel,
            programme,
            entryCount: entries.length,
            attachmentRemoved: removeAttachment && !attachmentFile,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          clientHostName: metadata.clientHostName,
        },
      });
    });

    if (attachmentFile && existing.storageKey) {
      await deleteEmployeeFileAttachment(existing.storageKey);
    } else if (removeAttachment && !attachmentFile && existing.storageKey) {
      await deleteEmployeeFileAttachment(existing.storageKey);
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update the qualification document.";
    return { status: "error", message };
  }

  revalidateQualificationPaths(employeeId);
  redirect(`/people/employees/${employeeId}/documents`);
}

export async function deleteEmployeeQualificationDocument(
  formData: FormData,
): Promise<void> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    throw new Error(actor.message);
  }

  const employeeId = textValue(formData, "employeeId");
  const documentId = textValue(formData, "documentId");

  const existing = await prisma.employeeQualificationDocument.findFirst({
    where: { id: documentId, employeeId },
    select: { id: true, title: true, storageKey: true },
  });

  if (!existing) {
    throw new Error("Qualification document not found.");
  }

  const metadata = await getAuditRequestMetadata(formData);

  await prisma.$transaction(async (transaction) => {
    await transaction.employeeQualificationDocument.delete({
      where: { id: existing.id },
    });

    await transaction.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "DELETE",
        entityType: "EmployeeQualificationDocument",
        entityId: existing.id,
        description: `Removed qualification “${existing.title}”`,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });
  });

  if (existing.storageKey) {
    await deleteEmployeeFileAttachment(existing.storageKey);
  }

  revalidateQualificationPaths(employeeId);
  redirect(`/people/employees/${employeeId}/documents`);
}
