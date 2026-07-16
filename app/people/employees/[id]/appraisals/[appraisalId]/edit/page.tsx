import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PerformanceAppraisalRatingForm } from "@/src/modules/hr/components/performance-appraisal-rating-form";
import { getPerformanceAppraisalProfile } from "@/src/modules/hr/data/get-performance-appraisals";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Enter Appraisal Ratings",
};

export const dynamic = "force-dynamic";

export default async function EditPerformanceAppraisalPage({
  params,
}: {
  params: Promise<{
    id: string;
    appraisalId: string;
  }>;
}) {
  await requirePeopleManageAccess();

  const { id, appraisalId } = await params;

  const appraisal = await getPerformanceAppraisalProfile(id, appraisalId);

  if (!appraisal) {
    notFound();
  }

  if (appraisal.status !== "DRAFT" && appraisal.status !== "IN_PROGRESS") {
    redirect(`/people/employees/${id}/appraisals/${appraisalId}`);
  }

  return <PerformanceAppraisalRatingForm appraisal={appraisal} />;
}
