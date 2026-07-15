import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { RoleForm } from "@/src/modules/admin/components/role-form"
import {
  getPermissionOptions,
  getRole,
} from "@/src/modules/admin/data/get-access-administration"

export const metadata: Metadata = {
  title: "Edit role",
}

export const dynamic = "force-dynamic"

export default async function EditRolePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [role, permissions] = await Promise.all([
    getRole(id),
    getPermissionOptions(),
  ])

  if (!role) {
    notFound()
  }

  return <RoleForm role={role} permissions={permissions} />
}
