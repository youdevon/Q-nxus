import { redirect } from "next/navigation";

import { DashboardPage } from "@/src/core/dashboard/dashboard-page";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";

export default async function Home() {
  const capabilities = await getUserCapabilities();

  // Self-service employees land on /me, not the operational dashboard.
  if (capabilities?.isEmployeeOnly) {
    redirect("/me");
  }

  return <DashboardPage />;
}
