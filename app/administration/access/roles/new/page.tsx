import type { Metadata } from "next";

import { RoleForm } from "@/src/modules/admin/components/role-form";
import {
  getPermissionOptions,
  getRoleTemplates,
} from "@/src/modules/admin/data/get-access-administration";

export const metadata: Metadata = {
  title: "Create role",
};

export const dynamic = "force-dynamic";

type NewRolePageProps = {
  searchParams: Promise<{
    from?: string;
  }>;
};

export default async function NewRolePage({ searchParams }: NewRolePageProps) {
  const { from } = await searchParams;
  const [permissions, templates] = await Promise.all([
    getPermissionOptions(),
    getRoleTemplates(),
  ]);

  const initialTemplate =
    from && from.length > 0
      ? (templates.find((template) => template.id === from) ?? null)
      : null;

  return (
    <RoleForm
      permissions={permissions}
      templates={templates}
      initialTemplate={initialTemplate}
    />
  );
}
