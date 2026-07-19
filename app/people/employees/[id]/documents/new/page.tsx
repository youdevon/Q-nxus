import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CorrespondenceForm } from "@/src/modules/hr/components/correspondence-form";
import { prisma } from "@/lib/prisma";
import { buildCorrespondenceFromTemplate } from "@/src/modules/hr/actions/manage-employee-correspondence";
import { getCorrespondenceTemplates } from "@/src/modules/hr/data/get-correspondence-templates";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "New Correspondence",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  templateId?: string;
}>;

export default async function NewEmployeeCorrespondencePage({
  params,
  searchParams,
}: {
  params: Promise<{
    id: string;
  }>;
  searchParams: SearchParams;
}) {
  await requirePeopleManageAccess();

  const { id } = await params;
  const query = await searchParams;

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
    },
  });

  if (!employee) {
    notFound();
  }

  const templates = await getCorrespondenceTemplates(employee.organizationId, {
    activeOnly: true,
  });

  const fromTemplate = query.templateId
    ? await buildCorrespondenceFromTemplate(id, query.templateId)
    : null;

  return (
    <CorrespondenceForm
      employee={employee}
      mode="create"
      templates={templates.map((template) => ({
        id: template.id,
        name: template.name,
        category: template.category,
      }))}
      initial={
        fromTemplate
          ? {
              category: fromTemplate.category,
              title: fromTemplate.title,
              body: fromTemplate.body,
              effectiveDate: new Date().toISOString().slice(0, 10),
              retentionUntil: null,
              employeeVisible: fromTemplate.employeeVisible,
              managerVisible: fromTemplate.managerVisible,
              requiresAcknowledgement: fromTemplate.requiresAcknowledgement,
              allowsEmployeeResponse: fromTemplate.allowsEmployeeResponse,
              templateId: fromTemplate.templateId,
            }
          : undefined
      }
    />
  );
}
