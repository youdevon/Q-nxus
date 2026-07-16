import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { LeaveWorkspace } from "@/src/modules/hr/components/leave-workspace"
import { getLeaveWorkspace } from "@/src/modules/hr/data/get-leave-requests"
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities"

export const metadata: Metadata = {
  title: "Leave",
}

export const dynamic = "force-dynamic"

export default async function LeavePage() {
  const capabilities = await getUserCapabilities()

  if (
    !capabilities?.canAny(
      "leave.request",
      "leave.approve",
      "leave.manage",
    )
  ) {
    redirect("/")
  }

  const data = await getLeaveWorkspace()

  return <LeaveWorkspace data={data} />
}
