import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AllowanceCategoryForm } from "@/src/modules/admin/components/allowance-category-form";
import { getAllowanceCategoryById } from "@/src/modules/admin/data/get-allowance-categories";

export const metadata: Metadata = {
  title: "Edit Allowance Category",
};

export const dynamic = "force-dynamic";

export default async function EditAllowanceCategoryPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;
  const category = await getAllowanceCategoryById(id);

  if (!category) {
    notFound();
  }

  return <AllowanceCategoryForm category={category} />;
}
