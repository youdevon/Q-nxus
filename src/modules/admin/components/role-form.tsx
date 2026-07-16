"use client"

import { useActionState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/src/components/layout/page-header"
import { AdministrationNav } from "./administration-nav"
import {
  saveRole,
  type RoleFormState,
} from "@/src/modules/admin/actions/save-role"
import type {
  PermissionOption,
  RoleRecord,
} from "@/src/modules/admin/data/get-access-administration"

type RoleFormProps = {
  role?: RoleRecord | null
  permissions: PermissionOption[]
}

const initialState: RoleFormState = {
  status: "idle",
  message: "",
}

function FieldError({
  id,
  message,
}: {
  id: string
  message?: string
}) {
  if (!message) {
    return null
  }

  return (
    <p id={id} className="mt-1 text-xs text-destructive">
      {message}
    </p>
  )
}

export function RoleForm({
  role,
  permissions,
}: RoleFormProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(
    saveRole,
    initialState,
  )

  const selectedPermissions = new Set(role?.permissionIds ?? [])

  const groupedPermissions = permissions.reduce<
    Record<string, PermissionOption[]>
  >((groups, permission) => {
    groups[permission.moduleKey] ??= []
    groups[permission.moduleKey].push(permission)
    return groups
  }, {})

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message)

      if (state.redirectTo) {
        router.push(state.redirectTo)
        router.refresh()
      }
    }

    if (state.status === "error") {
      toast.error(state.message)
    }

    if (state.status === "conflict") {
      toast.warning(state.message)
    }
  }, [router, state])

  return (
    <form
      action={formAction}
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8"
    >
      <input type="hidden" name="id" value={role?.id ?? ""} />
      <input
        type="hidden"
        name="updatedAt"
        value={role?.updatedAt.toISOString() ?? ""}
      />

      <AdministrationNav />

      <PageHeader
        title={role ? "Edit role" : "New role"}
        description="Configure the role identity and the permissions granted to its members."
        actions={
          <div className="flex gap-2">
            <Button
              nativeButton={false}
              variant="outline"
              render={
                <Link
                  href={
                    role
                      ? `/administration/access/roles/${role.id}`
                      : "/administration/access"
                  }
                />
              }
            >
              <ArrowLeft />
              Cancel
            </Button>

            <Button type="submit" disabled={isPending}>
              <Save />
              {isPending ? "Saving…" : "Save role"}
            </Button>
          </div>
        }
      />

      {state.status !== "idle" && (
        <div
          role={state.status === "success" ? "status" : "alert"}
          className={
            state.status === "success"
              ? "border-y border-border py-3 text-sm"
              : "border-y border-destructive/40 bg-destructive/5 py-3 text-sm"
          }
        >
          {state.message}
        </div>
      )}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Role details
          </h2>
          {role?.isSystem && (
            <Badge variant="outline">System role</Badge>
          )}
        </div>

        <div className="grid gap-5 border-y border-border py-5 md:grid-cols-2">
          <div>
            <label htmlFor="name" className="text-sm font-medium">
              Role name
            </label>
            <Input
              id="name"
              name="name"
              defaultValue={role?.name ?? ""}
              required
              className="mt-2"
            />
            <FieldError id="name-error" message={state.errors?.name} />
          </div>

          <div>
            <label htmlFor="code" className="text-sm font-medium">
              Role code
            </label>
            <Input
              id="code"
              name="code"
              defaultValue={role?.code ?? ""}
              required
              disabled={role?.isSystem}
              className="mt-2 font-mono uppercase"
            />
            {role?.isSystem && (
              <input type="hidden" name="code" value={role.code} />
            )}
            <FieldError id="code-error" message={state.errors?.code} />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="description"
              className="text-sm font-medium"
            >
              Description
            </label>
            <Textarea
              id="description"
              name="description"
              defaultValue={role?.description ?? ""}
              maxLength={1000}
              className="mt-2 min-h-28"
            />
            <FieldError
              id="description-error"
              message={state.errors?.description}
            />
          </div>

          <div className="flex items-start gap-3 md:col-span-2">
            <input
              id="isActive"
              name="isActive"
              type="checkbox"
              defaultChecked={role?.isActive ?? true}
              className="mt-0.5 size-4"
            />
            <div>
              <label htmlFor="isActive" className="text-sm font-medium">
                Role is active
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Inactive roles remain in audit history but should not be
                assigned to new users.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Permissions
          </h2>
          <span className="text-xs text-muted-foreground">
            {permissions.length} available
          </span>
        </div>

        <div className="divide-y divide-border border-y border-border">
          {Object.entries(groupedPermissions).map(
            ([moduleKey, modulePermissions]) => (
              <fieldset key={moduleKey} className="py-5">
                <legend className="mb-3 text-sm font-semibold capitalize">
                  {moduleKey.replaceAll("_", " ")}
                </legend>

                <div className="grid gap-3 md:grid-cols-2">
                  {modulePermissions.map((permission) => (
                    <label
                      key={permission.id}
                      className="flex items-start gap-3 border border-border p-3"
                    >
                      <input
                        type="checkbox"
                        name="permissionIds"
                        value={permission.id}
                        defaultChecked={selectedPermissions.has(
                          permission.id,
                        )}
                        className="mt-0.5 size-4"
                      />

                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {permission.name}
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                          {permission.code}
                        </span>
                        {permission.description && (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {permission.description}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ),
          )}
        </div>
      </section>
    </form>
  )
}
