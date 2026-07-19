import type { Metadata } from "next";

import { CorrespondenceTemplateForm } from "@/src/modules/hr/components/correspondence-template-form";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "New Letter Template",
};

export const dynamic = "force-dynamic";

export default async function NewCorrespondenceTemplatePage() {
  await requirePeopleManageAccess();
  return <CorrespondenceTemplateForm mode="create" />;
}
