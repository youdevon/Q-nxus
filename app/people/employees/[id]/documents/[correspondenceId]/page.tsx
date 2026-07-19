import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CorrespondenceDetailView } from "@/src/modules/hr/components/correspondence-detail-view";
import { getCorrespondenceDetail } from "@/src/modules/hr/data/get-employee-correspondence";
import { resolveEmployeeCorrespondenceAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Correspondence",
};

export const dynamic = "force-dynamic";

export default async function EmployeeCorrespondenceDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
    correspondenceId: string;
  }>;
}) {
  const { id, correspondenceId } = await params;
  const access = await resolveEmployeeCorrespondenceAccess(id);

  if (access.isSelfService) {
    notFound();
  }

  const detail = await getCorrespondenceDetail(id, correspondenceId, {
    managerView: access.isManagerView,
  });

  if (!detail) {
    notFound();
  }

  return (
    <CorrespondenceDetailView
      detail={detail}
      canManage={access.canManage}
      isSelfService={false}
      isManagerView={access.isManagerView}
      showPeopleNav={access.showPeopleNav}
      listHref={`/people/employees/${id}/documents`}
      listBackLabel="Employee file"
      editHref={
        access.canManage
          ? `/people/employees/${id}/documents/${correspondenceId}/edit`
          : undefined
      }
    />
  );
}
