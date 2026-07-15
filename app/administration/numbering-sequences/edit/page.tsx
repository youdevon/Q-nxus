import type { Metadata } from "next"

import { NumberingSequencesForm } from "@/src/modules/admin/components/numbering-sequences-form"
import { getNumberingSequences } from "@/src/modules/admin/data/get-numbering-sequences"

export const metadata: Metadata = {
  title: "Edit Numbering Sequences",
}

export const dynamic = "force-dynamic"

export default async function EditNumberingSequencesPage() {
  const sequences = await getNumberingSequences()

  return <NumberingSequencesForm sequences={sequences} />
}
