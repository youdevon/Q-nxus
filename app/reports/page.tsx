import type { Metadata } from "next";

import { ReportsHub } from "@/src/modules/reports/components/reports-hub";
import { requireReportsHubAccess } from "@/src/modules/reports/data/require-reports-access";

export const metadata: Metadata = {
  title: "Reports",
};

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const capabilities = await requireReportsHubAccess();

  return <ReportsHub capabilities={capabilities} />;
}
