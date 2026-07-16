import type { Metadata } from "next";

import { RoleForm } from "@/src/modules/admin/components/role-form";
import { getPermissionOptions } from "@/src/modules/admin/data/get-access-administration";

export const metadata: Metadata = {
  title: "New role",
};

export const dynamic = "force-dynamic";

export default async function NewRolePage() {
  const permissions = await getPermissionOptions();

  return <RoleForm permissions={permissions} />;
}
