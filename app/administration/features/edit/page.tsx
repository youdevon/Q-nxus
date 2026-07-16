import type { Metadata } from "next";

import { FeatureControlsForm } from "@/src/modules/admin/components/feature-controls-form";
import { getFeatureControls } from "@/src/modules/admin/data/get-feature-controls";

export const metadata: Metadata = {
  title: "Edit Feature Controls",
};

export const dynamic = "force-dynamic";

export default async function EditFeaturesPage() {
  const features = await getFeatureControls();

  return <FeatureControlsForm features={features} />;
}
