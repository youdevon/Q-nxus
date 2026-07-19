import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  KeyRound,
  Pencil,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import {
  activeStateBadgeVariant,
  recordStatusBadgeVariant,
} from "@/src/config/ui-colors";
import { AdministrationNav } from "@/src/modules/admin/components/administration-nav";
import { RoleActions } from "@/src/modules/admin/components/role-actions";
import { getRoleProfile } from "@/src/modules/admin/data/get-access-administration";
import {
  PERMISSION_GROUP_ORDER,
  permissionGroupKey,
  permissionGroupLabel,
  type PermissionGroupKey,
} from "@/src/modules/admin/lib/permission-groups";

export const metadata: Metadata = {
  title: "Role",
};

export const dynamic = "force-dynamic";

type RolePageProps = {
  params: Promise<{
    id: string;
  }>;
};

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function dateTime(value: Date): string {
  return value.toISOString().replace("T", " ").slice(0, 19);
}

export default async function RolePage({ params }: RolePageProps) {
  const { id } = await params;
  const role = await getRoleProfile(id);

  if (!role) {
    notFound();
  }

  const activeAssignments = role.assignments.filter(
    (assignment) =>
      assignment.status === "ACTIVE" || assignment.status === "PENDING",
  );

  const groupedPermissions = (() => {
    const groups = new Map<
      PermissionGroupKey,
      typeof role.permissions
    >();

    for (const permission of role.permissions) {
      const key = permissionGroupKey(permission);
      const list = groups.get(key) ?? [];
      list.push(permission);
      groups.set(key, list);
    }

    return PERMISSION_GROUP_ORDER.filter((key) => groups.has(key)).map(
      (key) => ({
        key,
        label: permissionGroupLabel(key),
        permissions: groups.get(key) ?? [],
      }),
    );
  })();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <AdministrationNav />

      <PageHeader
        title={role.name}
        description="Security role identity, permissions and user assignments."
        backHref="/administration/access"
        backLabel="Users and roles"
        actions={
          <div className="flex flex-wrap gap-2">
            {!role.isSystem && (
              <Button
                nativeButton={false}
                render={
                  <Link href={`/administration/access/roles/${role.id}/edit`} />
                }
              >
                <Pencil />
                Edit role
              </Button>
            )}
            <RoleActions
              roleId={role.id}
              roleName={role.name}
              isSystem={role.isSystem}
              assignmentCount={activeAssignments.length}
            />
          </div>
        }
      />

      <section>
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-14 items-center justify-center border border-border">
              <ShieldCheck className="size-6 text-muted-foreground" />
            </div>

            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                {role.name}
              </h2>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {role.code}
              </p>
              {role.description && (
                <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                  {role.description}
                </p>
              )}
              {role.isSystem && (
                <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                  Built-in system role — not editable or deletable. Duplicate
                  as a custom role to customize permissions.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={activeStateBadgeVariant(role.isActive)}>
              {role.isActive ? "Active" : "Inactive"}
            </Badge>

            <Badge variant="outline">
              {role.isSystem ? "System role" : "Custom role"}
            </Badge>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-8 md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Permissions</p>
          <p className="mt-1 text-2xl font-semibold">
            {role.permissions.length}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">User assignments</p>
          <p className="mt-1 text-2xl font-semibold">
            {role.assignments.length}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Created</p>
          <p className="mt-1 text-sm font-medium">{dateTime(role.createdAt)}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Last updated</p>
          <p className="mt-1 text-sm font-medium">{dateTime(role.updatedAt)}</p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Permissions
          </h2>
        </div>

        {role.permissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No permissions are assigned to this role.
          </p>
        ) : (
          <div className="space-y-8">
            {groupedPermissions.map((group) => (
              <section key={group.key}>
                <h3 className="mb-3 text-sm font-semibold tracking-wide uppercase">
                  {group.label}
                </h3>

                <div className="grid gap-3 md:grid-cols-2">
                  {group.permissions.map((permission) => (
                    <article
                      key={permission.id}
                      className="border border-border p-4"
                    >
                      <p className="text-sm font-medium">{permission.name}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {permission.code}
                      </p>
                      {permission.description && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {permission.description}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <UsersRound className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Assigned users
          </h2>
        </div>

        {role.assignments.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This role is not assigned to any users.
            </p>
            <p className="text-sm text-muted-foreground">
              To grant this role, open a user under{" "}
              <Link
                href="/administration/access"
                className="font-medium text-foreground hover:underline"
              >
                Users and Roles
              </Link>{" "}
              and use Assign a role (built-in and custom roles appear in the
              picker).
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {role.assignments.map((assignment) => (
              <Link
                key={assignment.id}
                href={`/administration/access/users/${assignment.user.id}`}
                className="flex items-center justify-between gap-4 py-4 hover:bg-muted/20"
              >
                <div>
                  <p className="text-sm font-medium">
                    {assignment.user.firstName} {assignment.user.lastName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {assignment.user.email}
                  </p>
                </div>

                <Badge variant={recordStatusBadgeVariant(assignment.status)}>
                  {label(assignment.status)}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
