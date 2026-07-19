"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { AdministrationNav } from "./administration-nav";
import {
  saveRole,
  type RoleFormState,
} from "@/src/modules/admin/actions/save-role";
import type {
  PermissionOption,
  RoleRecord,
  RoleTemplateOption,
} from "@/src/modules/admin/data/get-access-administration";
import {
  PERMISSION_GROUP_ORDER,
  permissionGroupKey,
  permissionGroupLabel,
  type PermissionGroupKey,
} from "@/src/modules/admin/lib/permission-groups";
import { slugifyRoleCode } from "@/src/modules/admin/lib/role-code";

type RoleFormProps = {
  role?: RoleRecord | null;
  permissions: PermissionOption[];
  /** Existing roles that can seed the permission picker (create only). */
  templates?: RoleTemplateOption[];
  /** Prefill from `?from=` when creating. */
  initialTemplate?: RoleTemplateOption | null;
};

const initialState: RoleFormState = {
  status: "idle",
  message: "",
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}

export function RoleForm({
  role,
  permissions,
  templates = [],
  initialTemplate = null,
}: RoleFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(saveRole, initialState);

  const [name, setName] = useState(
    role?.name ??
      (initialTemplate ? `${initialTemplate.name} (custom)` : ""),
  );
  const [code, setCode] = useState(
    role?.code ??
      (initialTemplate
        ? slugifyRoleCode(`${initialTemplate.code}_CUSTOM`)
        : ""),
  );
  const [codeTouched, setCodeTouched] = useState(Boolean(role?.code));
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<
    Set<string>
  >(
    () =>
      new Set(
        role?.permissionIds ?? initialTemplate?.permissionIds ?? [],
      ),
  );

  const groupedPermissions = useMemo(() => {
    const groups = new Map<PermissionGroupKey, PermissionOption[]>();

    for (const permission of permissions) {
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
  }, [permissions]);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);

      if (state.redirectTo) {
        router.push(state.redirectTo);
        router.refresh();
      }
    }

    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "conflict") {
      toast.warning(state.message);
    }
  }, [router, state]);

  function applyTemplate(templateId: string) {
    if (!templateId) {
      return;
    }

    const template = templates.find((item) => item.id === templateId);

    if (!template) {
      return;
    }

    setName(`${template.name} (custom)`);
    setCode(slugifyRoleCode(`${template.code}_CUSTOM`));
    setCodeTouched(true);
    setSelectedPermissionIds(new Set(template.permissionIds));
  }

  function togglePermission(permissionId: string, checked: boolean) {
    setSelectedPermissionIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(permissionId);
      } else {
        next.delete(permissionId);
      }

      return next;
    });
  }

  if (role?.isSystem) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
        <AdministrationNav />
        <PageHeader
          title="System role"
          description="Built-in roles are managed by the platform and cannot be edited."
          backHref={`/administration/access/roles/${role.id}`}
          backLabel="Role"
        />
        <p className="text-sm text-muted-foreground">
          Use <strong>Duplicate as custom role</strong> on the role page to
          create an editable copy with the same permissions.
        </p>
      </div>
    );
  }

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
        title={role ? "Edit role" : "Create role"}
        description="Compose a custom role from platform permissions. Assigning the role grants those capabilities."
        backHref={
          role
            ? `/administration/access/roles/${role.id}`
            : "/administration/access"
        }
        backLabel={role ? "Role" : "Users and roles"}
        actions={
          <FormPageActions
            cancelHref={
              role
                ? `/administration/access/roles/${role.id}`
                : "/administration/access"
            }
          >
            <Button type="submit" disabled={isPending}>
              <Save />
              {isPending ? "Saving…" : "Save role"}
            </Button>
          </FormPageActions>
        }
      />

      {state.status !== "idle" && (
        <div
          role={state.status === "success" ? "status" : "alert"}
          className={
            state.status === "success"
              ? "text-sm"
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
          <Badge variant="outline">Custom role</Badge>
        </div>

        {!role && templates.length > 0 && (
          <div className="mb-5">
            <label htmlFor="templateId" className="text-sm font-medium">
              Start from an existing role
            </label>
            <select
              id="templateId"
              className="mt-2 flex h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              defaultValue={initialTemplate?.id ?? ""}
              onChange={(event) => applyTemplate(event.target.value)}
            >
              <option value="">Blank role</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.isSystem ? " (system)" : ""} —{" "}
                  {template.permissionIds.length} permissions
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Prefills name, code, and permissions. You can change anything
              before saving.
            </p>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="name" className="text-sm font-medium">
              Role name
            </label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(event) => {
                const nextName = event.target.value;
                setName(nextName);

                if (!codeTouched) {
                  setCode(slugifyRoleCode(nextName));
                }
              }}
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
              value={code}
              onChange={(event) => {
                setCodeTouched(true);
                setCode(event.target.value.toUpperCase());
              }}
              placeholder="Auto-generated from name"
              className="mt-2 font-mono uppercase"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Optional. Leave blank or edit the suggested slug.
            </p>
            <FieldError id="code-error" message={state.errors?.code} />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="description"
              name="description"
              defaultValue={
                role?.description ?? initialTemplate?.description ?? ""
              }
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
            {selectedPermissionIds.size} selected · {permissions.length}{" "}
            available
          </span>
        </div>

        <div className="divide-y divide-border/70">
          {groupedPermissions.map((group) => (
            <fieldset key={group.key} className="py-5">
              <legend className="mb-3 text-sm font-semibold">
                {group.label}
              </legend>

              <div className="grid gap-3 md:grid-cols-2">
                {group.permissions.map((permission) => (
                  <label
                    key={permission.id}
                    className="flex items-start gap-3 border border-border p-3"
                  >
                    <input
                      type="checkbox"
                      name="permissionIds"
                      value={permission.id}
                      checked={selectedPermissionIds.has(permission.id)}
                      onChange={(event) =>
                        togglePermission(permission.id, event.target.checked)
                      }
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
          ))}
        </div>
      </section>
    </form>
  );
}
