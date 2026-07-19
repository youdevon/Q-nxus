import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrganizationForm } from "@/src/modules/admin/components/organization-form";
import { getOrganizationProfile } from "@/src/modules/admin/data/get-organization-profile";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { formatDisplayDateTime } from "@/src/lib/format";

export const metadata: Metadata = {
  title: "Edit Organization",
};

export const dynamic = "force-dynamic";

export default async function OrganizationPage() {
  const [organization, capabilities] = await Promise.all([
    getOrganizationProfile(),
    getUserCapabilities(),
  ]);

  if (!organization) {
    notFound();
  }

  const updatedAtLabel = formatDisplayDateTime(organization.updatedAt);

  return (
    <OrganizationForm
      organization={organization}
      updatedAtLabel={updatedAtLabel}
      canManageReporting={Boolean(capabilities?.can("people.manage"))}
    />
  );
}
