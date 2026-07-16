import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { EmploymentContractForm } from "@/src/modules/hr/components/employment-contract-form"
import {
  getAllowanceCategories,
  getEmployeeContractHistory,
  getEmploymentContractProfile,
} from "@/src/modules/hr/data/get-employment-contracts"

export const metadata: Metadata = {
  title: "Amend Employment Contract",
}

export const dynamic = "force-dynamic"

export default async function AmendEmploymentContractPage({
  params,
}: {
  params: Promise<{
    id: string
    contractId: string
  }>
}) {
  const { id, contractId } = await params

  const [
    history,
    sourceContract,
    allowanceCategories,
  ] = await Promise.all([
    getEmployeeContractHistory(id),
    getEmploymentContractProfile(id, contractId),
    getAllowanceCategories(),
  ])

  if (!history || !sourceContract) {
    notFound()
  }

  return (
    <EmploymentContractForm
      history={history}
      sourceContract={sourceContract}
      allowanceCategories={allowanceCategories}
    />
  )
}
