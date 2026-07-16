import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { EmployeeProfile } from "@/src/modules/hr/components/employee-profile"
import { getEmployeeProfile } from "@/src/modules/hr/data/get-employee-form-data"
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities"

export const metadata: Metadata = {
  title: "Employee Profile",
}

export const dynamic = "force-dynamic"

type EmployeePageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function EmployeePage({
  params,
}: EmployeePageProps) {
  const { id } = await params
  const capabilities = await getUserCapabilities()

  if (!capabilities) {
    redirect("/login")
  }

  const isOwnProfile = capabilities.employeeId === id
  const canManagePeople = capabilities.canAny(
    "people.directory.view",
    "people.manage",
  )

  if (!isOwnProfile && !canManagePeople) {
    notFound()
  }

  if (
    isOwnProfile &&
    !canManagePeople &&
    !capabilities.can("people.profile.view_own")
  ) {
    notFound()
  }

  const employee = await getEmployeeProfile(id)

  if (!employee) {
    notFound()
  }

  return (
    <EmployeeProfile
      employee={employee}
      canManage={capabilities.can("people.manage")}
      isOwnProfile={isOwnProfile}
    />
  )
}
