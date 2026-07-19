import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CorrespondenceTemplateForm } from "@/src/modules/hr/components/correspondence-template-form";
import { getCorrespondenceTemplateDetail } from "@/src/modules/hr/data/get-correspondence-templates";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Edit Letter Template",
};

export const dynamic = "force-dynamic";

export default async function EditCorrespondenceTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const capabilities = await requirePeopleManageAccess();
  const { templateId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: capabilities.userId },
    select: { organizationId: true },
  });

  if (!user) {
    notFound();
  }

  const template = await getCorrespondenceTemplateDetail(
    user.organizationId,
    templateId,
  );

  if (!template) {
    notFound();
  }

  return (
    <CorrespondenceTemplateForm
      mode="edit"
      initial={{
        id: template.id,
        name: template.name,
        category: template.category,
        defaultTitle: template.defaultTitle,
        body: template.body,
        employeeVisible: template.employeeVisible,
        requiresAcknowledgement: template.requiresAcknowledgement,
        allowsEmployeeResponse: template.allowsEmployeeResponse,
        isActive: template.isActive,
      }}
    />
  );
}
