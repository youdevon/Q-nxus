import Link from "next/link";
import type { Metadata } from "next";
import { Plus, WalletCards } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { activeStateBadgeVariant } from "@/src/config/ui-colors";
import { AdministrationNav } from "@/src/modules/admin/components/administration-nav";
import { getAllowanceCategoryList } from "@/src/modules/admin/data/get-allowance-categories";

export const metadata: Metadata = {
  title: "Allowance Categories",
};

export const dynamic = "force-dynamic";

export default async function AllowanceCategoriesPage() {
  const categories = await getAllowanceCategoryList();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <AdministrationNav />

      <PageHeader
        title="Allowance Categories"
        description="Manage the allowance categories available during employment contract entry."
        actions={
          <Button
            nativeButton={false}
            render={<Link href="/administration/allowances/new" />}
          >
            <Plus />
            New category
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-8 md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Categories</p>
          <p className="mt-1 text-2xl font-semibold">{categories.length}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="mt-1 text-2xl font-semibold">
            {categories.filter((category) => category.isActive).length}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Taxable defaults</p>
          <p className="mt-1 text-2xl font-semibold">
            {categories.filter((category) => category.isTaxableDefault).length}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Gratuity eligible</p>
          <p className="mt-1 text-2xl font-semibold">
            {
              categories.filter(
                (category) => category.includedInGratuityDefault,
              ).length
            }
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <WalletCards className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Categories
          </h2>
        </div>

        {categories.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No allowance categories have been configured.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/administration/allowances/${category.id}`}
                className="grid gap-5 py-5 hover:bg-muted/20 md:grid-cols-[1fr_10rem_10rem_10rem]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{category.name}</p>

                    {category.code && (
                      <Badge variant="outline">{category.code}</Badge>
                    )}

                    <Badge variant={activeStateBadgeVariant(category.isActive)}>
                      {category.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    {category.description || "No description provided."}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Contract uses</p>
                  <p className="mt-1 text-sm font-medium">
                    {category.contractAllowanceCount}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Taxable</p>
                  <p className="mt-1 text-sm font-medium">
                    {category.isTaxableDefault ? "Yes" : "No"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Gratuity</p>
                  <p className="mt-1 text-sm font-medium">
                    {category.includedInGratuityDefault
                      ? "Included"
                      : "Excluded"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
