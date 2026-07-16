import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BusinessUnitForm } from "@/src/modules/admin/components/business-unit-form";
import {
  getBusinessUnit,
  getBusinessUnitOptions,
} from "@/src/modules/admin/data/get-business-units";

export const metadata: Metadata = {
  title: "Edit Business Unit",
};

export const dynamic = "force-dynamic";

export default async function EditBusinessUnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [businessUnit, parentOptions] = await Promise.all([
    getBusinessUnit(id),
    getBusinessUnitOptions(id),
  ]);

  if (!businessUnit) {
    notFound();
  }

  return (
    <BusinessUnitForm
      businessUnit={businessUnit}
      parentOptions={parentOptions}
    />
  );
}
