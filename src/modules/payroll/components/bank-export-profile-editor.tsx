"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  updateBankExportProfile,
  type BankExportProfileFormState,
} from "@/src/modules/payroll/actions/update-bank-export-profile";

const initialState: BankExportProfileFormState = {
  status: "idle",
  message: "",
};

export type BankExportProfileEditorRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  adapterKind: string;
  isDefault: boolean;
  isPlaceholder: boolean;
  isActive: boolean;
  configurationJson: unknown;
};

export function BankExportProfileEditor({
  profile,
  canManage,
}: {
  profile: BankExportProfileEditorRow;
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateBankExportProfile,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  const configText = JSON.stringify(profile.configurationJson ?? {}, null, 2);

  return (
    <div className="border-b border-border/70 py-6 last:border-b-0">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="font-medium">{profile.name}</p>
        <Badge variant="outline">{profile.adapterKind}</Badge>
        {profile.isDefault ? <Badge variant="secondary">Default</Badge> : null}
        {profile.isPlaceholder ? (
          <Badge variant="outline">
            Placeholder / requires bank confirmation
          </Badge>
        ) : null}
        {!profile.isActive ? (
          <Badge variant="destructive">Inactive</Badge>
        ) : null}
      </div>
      <p className="mb-4 text-xs text-muted-foreground">Code: {profile.code}</p>

      {canManage ? (
        <form action={formAction} className="grid max-w-2xl gap-4">
          <input type="hidden" name="id" value={profile.id} />
          <div className="grid gap-2">
            <label htmlFor={`name-${profile.id}`} className="text-sm font-medium">
              Name
            </label>
            <Input
              id={`name-${profile.id}`}
              name="name"
              defaultValue={profile.name}
              required
            />
          </div>
          <div className="grid gap-2">
            <label
              htmlFor={`description-${profile.id}`}
              className="text-sm font-medium"
            >
              Description
            </label>
            <Textarea
              id={`description-${profile.id}`}
              name="description"
              defaultValue={profile.description ?? ""}
              rows={2}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={profile.isActive}
              className="size-4"
            />
            Active
          </label>
          <div className="grid gap-2">
            <label
              htmlFor={`config-${profile.id}`}
              className="text-sm font-medium"
            >
              configurationJson (adapter columns — not an official ACH layout)
            </label>
            <Textarea
              id={`config-${profile.id}`}
              name="configurationJson"
              defaultValue={configText}
              rows={8}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Placeholder profiles remain marked “requires bank confirmation”
              until the institution confirms the layout. Do not treat generic CSV
              columns as official ACH formats.
            </p>
          </div>
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </form>
      ) : profile.description ? (
        <p className="max-w-2xl text-sm text-muted-foreground">
          {profile.description}
        </p>
      ) : null}
    </div>
  );
}
