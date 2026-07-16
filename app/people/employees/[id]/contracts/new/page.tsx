import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { EmploymentContractForm } from "@/src/modules/hr/components/employment-contract-form"
import {
  getAllowanceCategories,
  getEmployeeContractHistory,
} from "@/src/modules/hr/data/get-employment-contracts"

export const metadata: Metadata = {
  title: "New Employment Contract",
}

export const dynamic = "force-dynamic"

export default async function NewEmploymentContractPage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } = await params
  const [history, allowanceCategories] =
    await Promise.all([
      getEmployeeContractHistory(id),
      getAllowanceCategories(),
    ])

  if (!history) {
    notFound()
  }

  return (
    <EmploymentContractForm
      history={history}
      allowanceCategories={allowanceCategories}
    />
  )
}
