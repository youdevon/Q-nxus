import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AssetRegisterDirectory } from "@/src/modules/assets/components/asset-register-directory";
import { getAssetRegister } from "@/src/modules/assets/data/get-assets";
import { requireAssetsViewAccess } from "@/src/modules/assets/data/require-assets-access";
import { EmployeeSectionChrome } from "@/src/modules/hr/components/employee-section-chrome";
import { getEmployeeEntityChrome } from "@/src/modules/hr/data/get-employee-entity-chrome";

export const metadata: Metadata = {
  title: "Employee assets",
};

export const dynamic = "force-dynamic";

export default async function EmployeeAssetsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [capabilities, chrome, data] = await Promise.all([
    requireAssetsViewAccess(),
    getEmployeeEntityChrome(id),
    getAssetRegister({ assignedEmployeeId: id, pageSize: 200 }),
  ]);

  if (!chrome) {
    notFound();
  }

  return (
    <EmployeeSectionChrome
      chrome={chrome}
      current="assets"
      title="Assets"
      description={`Hardware currently assigned to ${chrome.displayName}.`}
      actions={
        capabilities.can("assets.manage") ? (
          <Button
            nativeButton={false}
            render={<Link href="/assets/new" />}
          >
            <Plus />
            New asset
          </Button>
        ) : null
      }
    >
      <AssetRegisterDirectory
        data={data}
        filters={{}}
        showFilters={false}
      />
      {data.rows.length === 0 ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Assign assets from the{" "}
          <Link href="/assets" className="underline underline-offset-2">
            asset register
          </Link>
          .
        </p>
      ) : null}
    </EmployeeSectionChrome>
  );
}
