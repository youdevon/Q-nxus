import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { LeaveRequestDetailView } from "@/src/modules/hr/components/leave-request-detail"
import { getLeaveRequestDetail } from "@/src/modules/hr/data/get-leave-requests"

export const metadata: Metadata = {
  title: "Leave Request",
}

export const dynamic = "force-dynamic"

export default async function LeaveRequestPage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } = await params
  const request = await getLeaveRequestDetail(id)

  if (!request) {
    notFound()
  }

  return <LeaveRequestDetailView request={request} />
}
