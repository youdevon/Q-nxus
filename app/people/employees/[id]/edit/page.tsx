import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { EmployeeForm } from "@/src/modules/hr/components/employee-form"
import {
  getEmployeeById,
  getEmployeeFormOptions,
} from "@/src/modules/hr/data/get-employee-form-data"
import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities"

export const metadata: Metadata = {
  title: "Edit Employee",
}

export const dynamic = "force-dynamic"

type EditEmployeePageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function EditEmployeePage({
  params,
}: EditEmployeePageProps) {
  const capabilities = await getUserCapabilities()

  if (!capabilities) {
    redirect("/login")
  }

  if (!capabilities.can("people.manage")) {
    notFound()
  }

  const { id } = await params

  const [employee, departments] = await Promise.all([
    getEmployeeById(id),
    getEmployeeFormOptions(),
  ])

  if (!employee) {
    notFound()
  }

  return (
    <EmployeeForm
      employee={employee}
      departments={departments}
    />
  )
}
