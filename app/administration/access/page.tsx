import type { Metadata } from "next";

import { AccessDirectory } from "@/src/modules/admin/components/access-directory";
import { getAccessAdministration } from "@/src/modules/admin/data/get-access-administration";

export const metadata: Metadata = {
  title: "Users and Roles",
};

export const dynamic = "force-dynamic";

export default async function AccessPage() {
  const data = await getAccessAdministration();

  return (
    <AccessDirectory
      users={data.users}
      roles={data.roles}
      permissionCount={data.permissionCount}
    />
  );
}
