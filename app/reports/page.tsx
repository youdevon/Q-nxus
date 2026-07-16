import type { Metadata } from "next";

import { ModulePlaceholder } from "@/src/components/layout/module-placeholder";

export const metadata: Metadata = {
  title: "Reports",
};

export default function ReportsPage() {
  return (
    <ModulePlaceholder
      title="Reports"
      moduleName="Core"
      description="Cross-module analytics and scheduled reporting will live in this workspace."
    />
  );
}
