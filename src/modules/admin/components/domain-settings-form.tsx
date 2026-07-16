"use client";

import { useActionState, useEffect } from "react";
import {
  Braces,
  Calendar,
  CalendarClock,
  EyeOff,
  Save,
  Settings2,
  ToggleLeft,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { AdministrationNav } from "./administration-nav";
import {
  saveDomainSettings,
  type DomainSettingsFormState,
} from "@/src/modules/admin/actions/save-domain-settings";
import type { DomainSettingRecord } from "@/src/modules/admin/data/get-domain-settings";

type DomainSettingsFormProps = {
  settings: DomainSettingRecord[];
};

const initialState: DomainSettingsFormState = {
  status: "idle",
  message: "",
};

function dateValue(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

function settingValue(setting: DomainSettingRecord): string {
  if (setting.dataType === "JSON") {
    return JSON.stringify(setting.value, null, 2);
  }

  if (setting.dataType === "DATE") {
    return String(setting.value).slice(0, 10);
  }

  if (setting.dataType === "DATETIME") {
    const value = String(setting.value);
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return "";
    }

    return parsed.toISOString().slice(0, 16);
  }

  if (setting.value === null || typeof setting.value === "undefined") {
    return "";
  }

  return String(setting.value);
}

function dataTypeIcon(dataType: string) {
  switch (dataType) {
    case "BOOLEAN":
      return ToggleLeft;
    case "DATE":
      return Calendar;
    case "DATETIME":
      return CalendarClock;
    case "JSON":
      return Braces;
    default:
      return Settings2;
  }
}

function SettingValueInput({ setting }: { setting: DomainSettingRecord }) {
  const name = `value:${setting.id}`;
  const value = settingValue(setting);

  if (setting.dataType === "BOOLEAN") {
    return (
      <label className="flex items-start gap-3 pt-2">
        <input
          type="checkbox"
          name={name}
          defaultChecked={setting.value === true}
          className="mt-0.5 size-4"
        />

        <span>
          <span className="block text-sm font-medium">Enabled</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Turn this setting on or off.
          </span>
        </span>
      </label>
    );
  }

  if (setting.dataType === "JSON") {
    return (
      <Textarea
        name={name}
        defaultValue={value}
        rows={8}
        spellCheck={false}
        className="mt-2 font-mono text-xs"
      />
    );
  }

  if (setting.dataType === "INTEGER") {
    return (
      <Input
        name={name}
        type="number"
        step={1}
        defaultValue={value}
        className="mt-2"
      />
    );
  }

  if (setting.dataType === "DECIMAL") {
    return (
      <Input
        name={name}
        type="number"
        step="any"
        defaultValue={value}
        className="mt-2"
      />
    );
  }

  if (setting.dataType === "DATE") {
    return (
      <Input name={name} type="date" defaultValue={value} className="mt-2" />
    );
  }

  if (setting.dataType === "DATETIME") {
    return (
      <Input
        name={name}
        type="datetime-local"
        defaultValue={value}
        className="mt-2"
      />
    );
  }

  return (
    <Input
      name={name}
      type={setting.isSensitive ? "password" : "text"}
      defaultValue={value}
      autoComplete="off"
      className="mt-2"
    />
  );
}

export function DomainSettingsForm({ settings }: DomainSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveDomainSettings,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    }

    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "conflict") {
      toast.warning(state.message);
    }
  }, [state]);

  const groupedSettings = settings.reduce<
    Record<string, DomainSettingRecord[]>
  >((groups, setting) => {
    groups[setting.moduleKey] ??= [];
    groups[setting.moduleKey].push(setting);
    return groups;
  }, {});

  return (
    <form
      action={formAction}
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8"
    >
      <AdministrationNav />

      <PageHeader
        title="Domain Settings"
        description="Manage shared Organization and module configuration values, effective dates and operational status."
        backHref="/administration/settings"
        backLabel="Settings"
        actions={
          <FormPageActions cancelHref="/administration/settings">
            <Button type="submit" disabled={isPending}>
              <Save />
              {isPending ? "Saving…" : "Save settings"}
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

      <section aria-labelledby="settings-summary-heading">
        <h2
          id="settings-summary-heading"
          className="mb-3 text-sm font-semibold tracking-wide uppercase"
        >
          Settings summary
        </h2>

        <div className="grid grid-cols-2 gap-x-8 md:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Total settings</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {settings.length}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Modules</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {Object.keys(groupedSettings).length}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {settings.filter((setting) => setting.status === "ACTIVE").length}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Sensitive</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {settings.filter((setting) => setting.isSensitive).length}
            </p>
          </div>
        </div>
      </section>

      {settings.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No domain settings are configured.
        </p>
      ) : (
        <div className="space-y-10">
          {Object.entries(groupedSettings).map(
            ([moduleKey, moduleSettings]) => (
              <section key={moduleKey}>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-semibold tracking-wide uppercase">
                    {moduleKey.replaceAll("_", " ")}
                  </h2>

                  <span className="text-xs text-muted-foreground">
                    {moduleSettings.length} setting
                    {moduleSettings.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="divide-y divide-border/70">
                  {moduleSettings.map((setting) => {
                    const Icon = dataTypeIcon(setting.dataType);

                    return (
                      <article
                        key={setting.id}
                        className="grid gap-6 py-6 lg:grid-cols-[1fr_11rem_11rem_11rem]"
                      >
                        <input
                          type="hidden"
                          name="settingIds"
                          value={setting.id}
                        />
                        <input
                          type="hidden"
                          name={`version:${setting.id}`}
                          value={setting.version}
                        />

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Icon className="size-4 text-muted-foreground" />

                            <h3 className="font-medium">{setting.name}</h3>

                            <Badge variant="outline">{setting.dataType}</Badge>

                            {setting.isSensitive && (
                              <Badge variant="secondary">
                                <EyeOff />
                                Sensitive
                              </Badge>
                            )}
                          </div>

                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {setting.settingCode}
                          </p>

                          {setting.description && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {setting.description}
                            </p>
                          )}

                          <div className="mt-4">
                            <label className="text-sm font-medium">Value</label>
                            <SettingValueInput setting={setting} />
                          </div>

                          <p className="mt-3 text-xs text-muted-foreground">
                            Version {setting.version}
                          </p>
                        </div>

                        <div>
                          <label
                            htmlFor={`status:${setting.id}`}
                            className="text-sm font-medium"
                          >
                            Status
                          </label>

                          <select
                            id={`status:${setting.id}`}
                            name={`status:${setting.id}`}
                            defaultValue={setting.status}
                            className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                          >
                            <option value="DRAFT">Draft</option>
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                            <option value="ARCHIVED">Archived</option>
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor={`effectiveFrom:${setting.id}`}
                            className="text-sm font-medium"
                          >
                            Effective from
                          </label>

                          <Input
                            id={`effectiveFrom:${setting.id}`}
                            name={`effectiveFrom:${setting.id}`}
                            type="date"
                            defaultValue={dateValue(setting.effectiveFrom)}
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`effectiveUntil:${setting.id}`}
                            className="text-sm font-medium"
                          >
                            Effective until
                          </label>

                          <Input
                            id={`effectiveUntil:${setting.id}`}
                            name={`effectiveUntil:${setting.id}`}
                            type="date"
                            defaultValue={dateValue(setting.effectiveUntil)}
                            className="mt-2"
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ),
          )}
        </div>
      )}

      <footer className="flex justify-end border-t border-border pt-5">
        <Button type="submit" disabled={isPending}>
          <Save />
          {isPending ? "Saving…" : "Save settings"}
        </Button>
      </footer>
    </form>
  );
}
