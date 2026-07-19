"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Save, ShieldOff, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { recordStatusBadgeVariant } from "@/src/config/ui-colors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageActionsStart } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { AdministrationNav } from "./administration-nav";
import {
  saveUserAccess,
  type UserAccessFormState,
} from "@/src/modules/admin/actions/save-user-access";
import {
  revokeUserRole,
  type RoleAssignmentState,
} from "@/src/modules/admin/actions/manage-user-role";
import { AssignUserRoleForm } from "@/src/modules/admin/components/assign-user-role-form";
import { ResetUserPasswordForm } from "@/src/modules/admin/components/reset-user-password-form";
import type {
  AssignableRole,
  LinkableEmployeeOption,
  UserAccessRecord,
} from "@/src/modules/admin/data/get-user-access";
import { useAuth } from "@/src/modules/auth/context/auth-provider";

type UserAccessFormProps = {
  user: UserAccessRecord;
  roles: AssignableRole[];
  linkableEmployees: LinkableEmployeeOption[];
};

const initialUserState: UserAccessFormState = {
  status: "idle",
  message: "",
};

const initialAssignmentState: RoleAssignmentState = {
  status: "idle",
  message: "",
};

function dateValue(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export function UserAccessForm({
  user,
  roles,
  linkableEmployees,
}: UserAccessFormProps) {
  const router = useRouter();
  const { user: actor } = useAuth();
  const [userState, userAction, userPending] = useActionState(
    saveUserAccess,
    initialUserState,
  );

  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeUserRole,
    initialAssignmentState,
  );

  const activeAssignedRoleIds = user.assignments
    .filter(
      (assignment) =>
        assignment.status === "ACTIVE" || assignment.status === "PENDING",
    )
    .map((assignment) => assignment.roleId);

  useEffect(() => {
    if (userState.status === "success") {
      toast.success(userState.message);
      router.refresh();
    }

    if (userState.status === "error") {
      toast.error(userState.message);
    }

    if (userState.status === "conflict") {
      toast.warning(userState.message);
    }
  }, [userState, router]);

  useEffect(() => {
    if (revokeState.status === "success") {
      toast.success(revokeState.message);
      router.refresh();
    }

    if (revokeState.status === "error") {
      toast.error(revokeState.message);
    }
  }, [revokeState, router]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <AdministrationNav />

      <PageHeader
        title={`${user.firstName} ${user.lastName}`}
        description="Manage the user account, account status and effective security-role assignments."
        backHref={`/administration/access/users/${user.id}`}
        backLabel="User"
        actions={
          <PageActionsStart>
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href={`/administration/access/users/${user.id}`} />}
            >
              Cancel
            </Button>
          </PageActionsStart>
        }
      />

      <form action={userAction} className="flex flex-col gap-8">
        <input type="hidden" name="id" value={user.id} />
        <input type="hidden" name="version" value={user.version} />

        <section>
          <div className="mb-4 flex items-center gap-2">
            <UserRound className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              User account
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="text-sm font-medium">
                First name
              </label>
              <Input
                id="firstName"
                name="firstName"
                defaultValue={user.firstName}
                className="mt-2"
              />
              <FieldError message={userState.errors?.firstName} />
            </div>

            <div>
              <label htmlFor="lastName" className="text-sm font-medium">
                Last name
              </label>
              <Input
                id="lastName"
                name="lastName"
                defaultValue={user.lastName}
                className="mt-2"
              />
              <FieldError message={userState.errors?.lastName} />
            </div>

            <div>
              <label htmlFor="email" className="text-sm font-medium">
                Email address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={user.email}
                className="mt-2"
              />
              <FieldError message={userState.errors?.email} />
            </div>

            <div>
              <label htmlFor="employeeId" className="text-sm font-medium">
                Linked employee
              </label>
              <select
                id="employeeId"
                name="employeeId"
                defaultValue={user.employeeId ?? ""}
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
              >
                <option value="">No employee link</option>
                {linkableEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.lastName}, {employee.firstName} ·{" "}
                    {employee.employeeNumber}
                    {employee.positionTitle
                      ? ` · ${employee.positionTitle}`
                      : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Required for leave approvals when this person is a supervisor.
              </p>
              <FieldError message={userState.errors?.employeeId} />
            </div>

            <div>
              <label htmlFor="status" className="text-sm font-medium">
                Account status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={user.status}
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
              >
                <option value="INVITED">Invited</option>
                <option value="ACTIVE">Active</option>
                <option value="LOCKED">Locked</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="DISABLED">Disabled</option>
                <option value="ARCHIVED">Archived</option>
              </select>
              <FieldError message={userState.errors?.status} />
            </div>

            <div className="flex items-start gap-3 md:col-span-2">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                defaultChecked={user.isActive}
                className="mt-0.5 size-4"
              />
              <div>
                <label htmlFor="isActive" className="text-sm font-medium">
                  Account is active
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Inactive accounts should not be permitted to sign in.
                </p>
              </div>
            </div>
          </div>

          {userState.status !== "idle" && (
            <p
              className={
                userState.status === "success"
                  ? "mt-3 text-sm"
                  : "mt-3 text-sm text-destructive"
              }
            >
              {userState.message}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={userPending}>
              <Save />
              {userPending ? "Saving…" : "Save account"}
            </Button>
          </div>
        </section>
      </form>

      <ResetUserPasswordForm
        userId={user.id}
        userName={`${user.firstName} ${user.lastName}`}
        isSelf={actor?.id === user.id}
      />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Role assignments
          </h2>
        </div>

        {user.assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No role assignments exist for this user.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-200 text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Effective from</th>
                  <th className="px-3 py-3 font-medium">Effective until</th>
                  <th className="px-3 py-3 font-medium">Reason</th>
                  <th className="px-3 py-3 font-medium">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {user.assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td className="px-3 py-3">
                      <p className="font-medium">{assignment.roleName}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {assignment.roleCode}
                      </p>
                    </td>

                    <td className="px-3 py-3">
                      <Badge
                        variant={recordStatusBadgeVariant(assignment.status)}
                      >
                        {assignment.status}
                      </Badge>
                    </td>

                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {dateValue(assignment.effectiveFrom)}
                    </td>

                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {assignment.effectiveUntil
                        ? dateValue(assignment.effectiveUntil)
                        : "Open-ended"}
                    </td>

                    <td className="max-w-60 px-3 py-3 text-xs text-muted-foreground">
                      {assignment.reason ?? "—"}
                    </td>

                    <td className="px-3 py-3">
                      {assignment.status === "ACTIVE" ||
                      assignment.status === "PENDING" ? (
                        <form action={revokeAction}>
                          <input
                            type="hidden"
                            name="assignmentId"
                            value={assignment.id}
                          />
                          <input type="hidden" name="userId" value={user.id} />
                          <input
                            type="hidden"
                            name="revocationReason"
                            value="Revoked through Access Administration."
                          />
                          <Button
                            type="submit"
                            variant="destructive"
                            size="sm"
                            disabled={revokePending}
                          >
                            <ShieldOff />
                            Revoke
                          </Button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No action
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AssignUserRoleForm
        userId={user.id}
        roles={roles}
        assignedRoleIds={activeAssignedRoleIds}
      />
    </div>
  );
}
