import Link from "next/link";
import { KeyRound, Plus, ShieldCheck, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import {
  activeStateBadgeVariant,
  recordStatusBadgeVariant,
} from "@/src/config/ui-colors";
import { AdministrationNav } from "./administration-nav";
import type {
  AccessRoleListItem,
  AccessUserListItem,
} from "@/src/modules/admin/data/get-access-administration";

type AccessDirectoryProps = {
  users: AccessUserListItem[];
  roles: AccessRoleListItem[];
  permissionCount: number;
};

export function AccessDirectory({
  users,
  roles,
  permissionCount,
}: AccessDirectoryProps) {
  const activeUsers = users.filter(
    (user) => user.isActive && user.status === "ACTIVE",
  ).length;

  const activeRoles = roles.filter((role) => role.isActive).length;

  return (
    <PageShell size="lg">
      <AdministrationNav />

      <PageHeader
        title="Users and Roles"
        description="Manage platform accounts, security roles and permission assignments."
        actions={
          <Button
            nativeButton={false}
            render={<Link href="/administration/access/roles/new" />}
          >
            <Plus />
            New role
          </Button>
        }
      />

      <section aria-labelledby="access-summary-heading">
        <h2
          id="access-summary-heading"
          className="mb-3 text-sm font-semibold tracking-wide uppercase"
        >
          Access summary
        </h2>

        <div className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">User accounts</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {users.length}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {activeUsers} active
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Security roles</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {roles.length}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {activeRoles} active
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Permissions</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {permissionCount}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Available capabilities
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">System roles</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {roles.filter((role) => role.isSystem).length}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Platform-managed
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="roles-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2
            id="roles-heading"
            className="text-sm font-semibold tracking-wide uppercase"
          >
            Roles
          </h2>
          <span className="text-xs text-muted-foreground">
            {roles.length} role{roles.length === 1 ? "" : "s"}
          </span>
        </div>

        {roles.length === 0 ? (
          <div className="py-10 text-center">
            <ShieldCheck className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No roles configured</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-175 text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 font-medium">Permissions</th>
                  <th className="px-3 py-3 font-medium">Users</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {roles.map((role) => (
                  <tr
                    key={role.id}
                    className="relative hover:bg-muted/30 focus-within:bg-muted/30"
                  >
                    <td className="px-3 py-3">
                      <Link
                        href={`/administration/access/roles/${role.id}`}
                        className="font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-none"
                      >
                        {role.name}
                      </Link>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {role.code}
                      </p>
                      {role.description && (
                        <p className="mt-1 max-w-md truncate text-xs text-muted-foreground">
                          {role.description}
                        </p>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <Badge variant="outline">
                        {role.isSystem ? "System" : "Custom"}
                      </Badge>
                    </td>

                    <td className="px-3 py-3 tabular-nums">
                      {role.permissionCount}
                    </td>

                    <td className="px-3 py-3 tabular-nums">{role.userCount}</td>

                    <td className="px-3 py-3">
                      <Badge variant={activeStateBadgeVariant(role.isActive)}>
                        {role.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="users-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2
            id="users-heading"
            className="text-sm font-semibold tracking-wide uppercase"
          >
            Users
          </h2>
          <span className="text-xs text-muted-foreground">
            {users.length} account{users.length === 1 ? "" : "s"}
          </span>
        </div>

        {users.length === 0 ? (
          <div className="py-10 text-center">
            <UserRound className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              No user accounts configured
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-175 text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">User</th>
                  <th className="px-3 py-3 font-medium">Email</th>
                  <th className="px-3 py-3 font-medium">Roles</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Last login</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="relative hover:bg-muted/30 focus-within:bg-muted/30"
                  >
                    <td className="px-3 py-3 font-medium">
                      <Link
                        href={`/administration/access/users/${user.id}`}
                        className="after:absolute after:inset-0 hover:underline focus-visible:outline-none"
                      >
                        {user.firstName} {user.lastName}
                      </Link>
                    </td>

                    <td className="px-3 py-3 text-muted-foreground">
                      {user.email}
                    </td>

                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <KeyRound className="size-3.5 text-muted-foreground" />
                        <span className="tabular-nums">{user.roleCount}</span>
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      <Badge
                        variant={
                          user.isActive && user.status === "ACTIVE"
                            ? "success"
                            : recordStatusBadgeVariant(user.status)
                        }
                      >
                        {user.status}
                      </Badge>
                    </td>

                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {user.lastLoginAt
                        ? user.lastLoginAt
                            .toISOString()
                            .replace("T", " ")
                            .slice(0, 16)
                        : "Never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageShell>
  );
}
