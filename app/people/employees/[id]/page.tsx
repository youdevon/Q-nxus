import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { EmployeeForm } from "@/src/modules/hr/components/employee-form"
import {
  getEmployeeById,
  getEmployeeFormOptions,
} from "@/src/modules/hr/data/get-employee-form-data"

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
