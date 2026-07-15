import type { Metadata } from "next"

import { DepartmentRecordForm } from "@/src/modules/hr/components/structure-record-form"

export const metadata: Metadata = {
  title: "New Department",
}

export default function NewDepartmentPage() {
  return <DepartmentRecordForm />
}
