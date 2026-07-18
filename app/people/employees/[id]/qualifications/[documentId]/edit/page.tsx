import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { QualificationForm } from "@/src/modules/hr/components/qualification-form";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Edit Qualification",
};

export const dynamic = "force-dynamic";

export default async function EditQualificationPage({
  params,
}: {
  params: Promise<{ id: string; documentId: string }>;
}) {
  await requirePeopleManageAccess();
  const { id, documentId } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
    },
  });

  const document = await prisma.employeeQualificationDocument.findFirst({
    where: { id: documentId, employeeId: id },
    include: {
      entries: {
        orderBy: [{ sortOrder: "asc" }, { subjectOrName: "asc" }],
      },
    },
  });

  if (!employee || !document) {
    notFound();
  }

  return (
    <QualificationForm
      employee={employee}
      mode="edit"
      initial={{
        id: document.id,
        documentType: document.documentType,
        qualificationSubtype: document.qualificationSubtype,
        degreeType: document.degreeType,
        customTypeLabel: document.customTypeLabel,
        programme: document.programme,
        issuer: document.issuer,
        issueDate: document.issueDate?.toISOString().slice(0, 10) ?? null,
        year: document.year,
        employeeVisible: document.employeeVisible,
        notes: document.notes,
        hasAttachment: Boolean(document.storageKey),
        fileName: document.fileName,
        entries: document.entries.map((entry) => ({
          id: entry.id,
          subjectOrName: entry.subjectOrName,
          gradeOrResult: entry.gradeOrResult,
          level: entry.level,
          sortOrder: entry.sortOrder,
        })),
      }}
    />
  );
}
