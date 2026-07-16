import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LeaveWorkspace } from "@/src/modules/hr/components/leave-workspace";
import { getLeaveWorkspace } from "@/src/modules/hr/data/get-leave-requests";
import { getVacationForfeitureWarningForEmployee } from "@/src/modules/hr/data/get-vacation-forfeiture-warning";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { notifyVacationForfeitureReminders } from "@/src/modules/hr/services/notify-vacation-forfeiture";

export const metadata: Metadata = {
  title: "Leave",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  view?: string;
}>;

export default async function LeavePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const capabilities = await getUserCapabilities();

  if (!capabilities?.canAny("leave.request", "leave.approve", "leave.manage")) {
    redirect("/");
  }

  const params = await searchParams;
  const view = params.view === "on-leave" ? "on-leave" : "default";

  if (capabilities.employeeId) {
    try {
      await notifyVacationForfeitureReminders({
        employeeId: capabilities.employeeId,
      });
    } catch (error) {
      console.error("Vacation forfeiture reminder pass failed:", error);
    }
  }

  const [data, vacationForfeitureWarning] = await Promise.all([
    getLeaveWorkspace(),
    capabilities.employeeId
      ? getVacationForfeitureWarningForEmployee(capabilities.employeeId)
      : Promise.resolve(null),
  ]);

  return (
    <LeaveWorkspace
      data={data}
      view={view}
      vacationForfeitureWarning={vacationForfeitureWarning}
    />
  );
}
