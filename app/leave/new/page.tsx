import type { Metadata } from "next"

import { LeaveRequestForm } from "@/src/modules/hr/components/leave-request-form"
import { getNewLeaveRequestData } from "@/src/modules/hr/data/get-new-leave-request-data"

export const metadata: Metadata = {
  title: "Request Leave",
}

export const dynamic = "force-dynamic"

export default async function NewLeaveRequestPage() {
  const data = await getNewLeaveRequestData()

  return <LeaveRequestForm data={data} />
}
