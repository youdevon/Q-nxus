import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CorrespondenceDetailView } from "@/src/modules/hr/components/correspondence-detail-view";
import { getCorrespondenceDetail } from "@/src/modules/hr/data/get-employee-correspondence";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "My Document",
};

export const dynamic = "force-dynamic";

export default async function MyDocumentDetailPage({
  params,
}: {
  params: Promise<{
    correspondenceId: string;
  }>;
}) {
  const capabilities = await requireAuthenticatedCapabilities();

  if (
    !capabilities.can("people.profile.view_own") ||
    !capabilities.employeeId
  ) {
    redirect("/");
  }

  const { correspondenceId } = await params;
  const detail = await getCorrespondenceDetail(
    capabilities.employeeId,
    correspondenceId,
    { selfServiceOnly: true },
  );

  if (!detail) {
    notFound();
  }

  return (
    <CorrespondenceDetailView
      detail={detail}
      canManage={false}
      isSelfService
      listHref="/me/documents"
      listBackLabel="My documents"
    />
  );
}
