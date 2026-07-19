import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CorrespondenceForm } from "@/src/modules/hr/components/correspondence-form";
import { getCorrespondenceDetail } from "@/src/modules/hr/data/get-employee-correspondence";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";
import { canHrEditCorrespondence } from "@/src/modules/hr/lib/correspondence-visibility";

export const metadata: Metadata = {
  title: "Edit Correspondence",
};

export const dynamic = "force-dynamic";

export default async function EditEmployeeCorrespondencePage({
  params,
}: {
  params: Promise<{
    id: string;
    correspondenceId: string;
  }>;
}) {
  await requirePeopleManageAccess();

  const { id, correspondenceId } = await params;
  const detail = await getCorrespondenceDetail(id, correspondenceId);

  if (!detail) {
    notFound();
  }

  if (
    !canHrEditCorrespondence(
      detail.status as
        | "DRAFT"
        | "ISSUED"
        | "ACKNOWLEDGED"
        | "ARCHIVED"
        | "SUPERSEDED",
    )
  ) {
    notFound();
  }

  return (
    <CorrespondenceForm
      employee={detail.employee}
      mode="edit"
      initial={{
        id: detail.id,
        category: detail.category,
        subType: detail.subType,
        title: detail.title,
        body: detail.body,
        effectiveDate: detail.effectiveDate,
        retentionUntil: detail.retentionUntil,
        employeeVisible: detail.employeeVisible,
        managerVisible: detail.managerVisible,
        requiresAcknowledgement: detail.requiresAcknowledgement,
        allowsEmployeeResponse: detail.allowsEmployeeResponse,
        templateId: detail.templateId,
      }}
    />
  );
}
