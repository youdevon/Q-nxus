"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  updateBankExportProfile,
  type BankExportProfileFormState,
} from "@/src/modules/payroll/actions/update-bank-export-profile";
import {
  DEFAULT_FIRST_CITIZENS_CONFIGURATION,
  parseFirstCitizensConfiguration,
  type FirstCitizensConfiguration,
} from "@/src/modules/payroll/lib/first-citizens-export";

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

function isFirstCitizensAdapter(adapterKind: string): boolean {
  return (
    adapterKind === "FIRST_CITIZENS_MANUAL_WORKSHEET" ||
    adapterKind === "FIRST_CITIZENS_IMPORT"
  );
}

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

  const isFcb = isFirstCitizensAdapter(profile.adapterKind);
  const initialFcb = useMemo(
    () => parseFirstCitizensConfiguration(profile.configurationJson),
    [profile.configurationJson],
  );
  const [fcb, setFcb] = useState<FirstCitizensConfiguration>(initialFcb);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const configText = isFcb
    ? JSON.stringify(fcb, null, 2)
    : JSON.stringify(profile.configurationJson ?? {}, null, 2);

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

          {isFcb ? (
            <div className="grid gap-4 rounded-md border border-border/70 p-4">
              <div>
                <p className="text-sm font-medium">First Citizens fields</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Maps to First Citizens Business Online ACH fields. Global
                  Addenda and Entry Description are required by the bank form.
                  Discretionary Data defaults to the payroll period name when
                  blank. Import file generation stays disabled until the bank
                  confirms layout.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground">
                    Originating institution
                  </label>
                  <Input
                    value={fcb.originatingInstitution ?? ""}
                    onChange={(event) =>
                      setFcb((current) => ({
                        ...current,
                        originatingInstitution: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground">
                    Company ACH ID
                  </label>
                  <Input
                    value={fcb.companyAchId ?? ""}
                    onChange={(event) =>
                      setFcb((current) => ({
                        ...current,
                        companyAchId: event.target.value || null,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground">
                    ACH type
                  </label>
                  <select
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={fcb.achType ?? "PPD"}
                    onChange={(event) =>
                      setFcb((current) => ({
                        ...current,
                        achType: event.target.value === "CCD" ? "CCD" : "PPD",
                      }))
                    }
                  >
                    <option value="PPD">PPD (payroll)</option>
                    <option value="CCD">CCD</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground">
                    Default purpose code
                  </label>
                  <Input
                    value={fcb.defaultPurposeCode ?? ""}
                    onChange={(event) =>
                      setFcb((current) => ({
                        ...current,
                        defaultPurposeCode: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground">
                    Entry description (required)
                  </label>
                  <Input
                    value={fcb.entryDescription ?? ""}
                    placeholder="Salary"
                    required
                    onChange={(event) =>
                      setFcb((current) => ({
                        ...current,
                        entryDescription: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground">
                    Global addenda (required)
                  </label>
                  <Input
                    value={fcb.globalAddenda ?? ""}
                    placeholder="Payroll"
                    required
                    onChange={(event) =>
                      setFcb((current) => ({
                        ...current,
                        globalAddenda: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground">
                    Discretionary data
                  </label>
                  <Input
                    value={fcb.discretionaryData ?? ""}
                    placeholder="July 2026 (blank = payroll period name)"
                    onChange={(event) =>
                      setFcb((current) => ({
                        ...current,
                        discretionaryData: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground">
                    Transaction type
                  </label>
                  <select
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={fcb.transactionType ?? "Credit"}
                    onChange={(event) =>
                      setFcb((current) => ({
                        ...current,
                        transactionType:
                          event.target.value === "Debit" ? "Debit" : "Credit",
                      }))
                    }
                  >
                    <option value="Credit">Credit</option>
                    <option value="Debit">Debit</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground">
                    Balance account (required)
                  </label>
                  <Input
                    value={fcb.balanceAccountMasked ?? ""}
                    placeholder="xxx5620 - TTD"
                    required
                    onChange={(event) =>
                      setFcb((current) => ({
                        ...current,
                        balanceAccountMasked: event.target.value || undefined,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground">
                    Export format label
                  </label>
                  <Input
                    value={fcb.exportFormat ?? ""}
                    onChange={(event) =>
                      setFcb((current) => ({
                        ...current,
                        exportFormat: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={fcb.importFileDisabled !== false}
                  onChange={(event) =>
                    setFcb((current) => ({
                      ...current,
                      importFileDisabled: event.target.checked,
                    }))
                  }
                />
                Keep import-file download disabled (recommended until bank
                confirms)
              </label>
              <div className="grid gap-2">
                <label className="text-xs text-muted-foreground">
                  Import disabled reason
                </label>
                <Textarea
                  rows={2}
                  value={fcb.importDisabledReason ?? ""}
                  onChange={(event) =>
                    setFcb((current) => ({
                      ...current,
                      importDisabledReason: event.target.value,
                    }))
                  }
                />
              </div>
              <input type="hidden" name="configurationJson" value={configText} />
              <button
                type="button"
                className="justify-self-start text-xs text-muted-foreground underline"
                onClick={() => setAdvancedOpen((open) => !open)}
              >
                {advancedOpen ? "Hide" : "Show"} raw configurationJson
              </button>
              {advancedOpen ? (
                <pre className="max-h-48 overflow-auto rounded-md border border-border/70 bg-muted/20 p-3 text-xs">
                  {configText}
                </pre>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {DEFAULT_FIRST_CITIZENS_CONFIGURATION.importDisabledReason}
              </p>
            </div>
          ) : (
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
                until the institution confirms the layout. Do not treat generic
                CSV columns as official ACH formats.
              </p>
            </div>
          )}
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
