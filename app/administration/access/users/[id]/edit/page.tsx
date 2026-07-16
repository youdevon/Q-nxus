import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { UserAccessForm } from "@/src/modules/admin/components/user-access-form"
import {
  getAssignableRoles,
  getLinkableEmployees,
  getUserAccess,
} from "@/src/modules/admin/data/get-user-access"

export const metadata: Metadata = {
  title: "User access",
}

export const dynamic = "force-dynamic"

export default async function UserAccessPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const user = await getUserAccess(id)

  if (!user) {
    notFound()
  }

  const [roles, linkableEmployees] = await Promise.all([
    getAssignableRoles(user.organizationId),
    getLinkableEmployees(user.organizationId, user.employeeId),
  ])

  return (
    <UserAccessForm
      user={user}
      roles={roles}
      linkableEmployees={linkableEmployees}
    />
  )
}
