import type { Metadata } from "next";

import { DomainSettingsForm } from "@/src/modules/admin/components/domain-settings-form";
import { getDomainSettings } from "@/src/modules/admin/data/get-domain-settings";

export const metadata: Metadata = {
  title: "Edit Domain Settings",
};

export const dynamic = "force-dynamic";

export default async function EditDomainSettingsPage() {
  const settings = await getDomainSettings();

  return <DomainSettingsForm settings={settings} />;
}
