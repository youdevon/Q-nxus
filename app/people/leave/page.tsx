import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LeaveWorkspace } from "@/src/modules/hr/components/leave-workspace";
import { getLeaveWorkspace } from "@/src/modules/hr/data/get-leave-requests";
import { getVacationForfeitureQueue } from "@/src/modules/hr/data/get-vacation-forfeiture-queue";
import { getVacationForfeitureWarningForEmployee } from "@/src/modules/hr/data/get-vacation-forfeiture-warning";
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { prisma } from "@/lib/prisma";

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
  const [capabilities, params] = await Promise.all([
    getUserCapabilities(),
    searchParams,
  ]);

  // Management workspace — not a personal leave page.
  if (
    !capabilities?.canAny(
      "leave.approve",
      "leave.manage",
      "people.directory.view",
    )
  ) {
    // Self-service users manage their own requests under My Profile.
    if (capabilities?.can("leave.request")) {
      redirect("/me/leave");
    }

    redirect("/");
  }

  const view = params.view === "on-leave" ? "on-leave" : "default";
  const canManageLeave = Boolean(capabilities?.can("leave.manage"));

  const organization = canManageLeave
    ? await prisma.organization.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
    : null;

  const [data, vacationForfeitureWarning, vacationForfeitureQueue] =
    await Promise.all([
      getLeaveWorkspace(),
      capabilities.employeeId
        ? getVacationForfeitureWarningForEmployee(capabilities.employeeId)
        : Promise.resolve(null),
      organization
        ? getVacationForfeitureQueue(organization.id)
        : Promise.resolve([]),
    ]);

  return (
    <LeaveWorkspace
      data={data}
      view={view}
      vacationForfeitureWarning={vacationForfeitureWarning}
      vacationForfeitureQueue={vacationForfeitureQueue}
    />
  );
}
