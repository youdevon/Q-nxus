import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { UserAccessForm } from "@/src/modules/admin/components/user-access-form"
import {
  getAssignableRoles,
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

  const roles = await getAssignableRoles(user.organizationId)

  return <UserAccessForm user={user} roles={roles} />
}
