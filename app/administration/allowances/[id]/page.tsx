import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pencil, WalletCards } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { activeStateBadgeVariant } from "@/src/config/ui-colors";
import { AdministrationNav } from "@/src/modules/admin/components/administration-nav";
import { getAllowanceCategoryById } from "@/src/modules/admin/data/get-allowance-categories";

export const metadata: Metadata = {
  title: "Allowance Category",
};

export const dynamic = "force-dynamic";

export default async function AllowanceCategoryPage({
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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <AdministrationNav />

      <PageHeader
        title={category.name}
        description="Allowance category profile and default treatment."
        backHref="/administration/allowances"
        backLabel="Allowances"
        actions={
          <Button
            nativeButton={false}
            render={
              <Link href={`/administration/allowances/${category.id}/edit`} />
            }
          >
            <Pencil />
            Edit category
          </Button>
        }
      />

      <section>
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex size-14 items-center justify-center border border-border">
              <WalletCards className="size-6 text-muted-foreground" />
            </div>

            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                {category.name}
              </h2>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {category.code || "No code"}
              </p>
              <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
                {category.description || "No description provided."}
              </p>
            </div>
          </div>

          <Badge variant={activeStateBadgeVariant(category.isActive)}>
            {category.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </section>

      <section className="grid gap-8 md:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Taxable by default</p>
          <p className="mt-1 text-sm font-medium">
            {category.isTaxableDefault ? "Yes" : "No"}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Included in gratuity</p>
          <p className="mt-1 text-sm font-medium">
            {category.includedInGratuityDefault ? "Yes" : "No"}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Contract allowance records
          </p>
          <p className="mt-1 text-sm font-medium">
            {category.contractAllowanceCount}
          </p>
        </div>
      </section>
    </div>
  );
}
