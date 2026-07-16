import Link from "next/link";
import type { Metadata } from "next";
import { EyeOff, Pencil, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { recordStatusBadgeVariant } from "@/src/config/ui-colors";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { AdministrationNav } from "@/src/modules/admin/components/administration-nav";
import {
  getDomainSettings,
  type DomainSettingRecord,
} from "@/src/modules/admin/data/get-domain-settings";

export const metadata: Metadata = {
  title: "Domain Settings",
};

export const dynamic = "force-dynamic";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function settingValue(setting: DomainSettingRecord): string {
  if (setting.isSensitive) {
    return "Sensitive value hidden";
  }

  if (setting.value === null || typeof setting.value === "undefined") {
    return "Not configured";
  }

  if (setting.dataType === "BOOLEAN") {
    return setting.value === true ? "Enabled" : "Disabled";
  }

  if (setting.dataType === "JSON") {
    return JSON.stringify(setting.value, null, 2);
  }

  return String(setting.value);
}

export default async function DomainSettingsPage() {
  const settings = await getDomainSettings();

  const groupedSettings = settings.reduce<
    Record<string, DomainSettingRecord[]>
  >((groups, setting) => {
    groups[setting.moduleKey] ??= [];
    groups[setting.moduleKey].push(setting);
    return groups;
  }, {});

  const activeCount = settings.filter(
    (setting) => setting.status === "ACTIVE",
  ).length;

  const sensitiveCount = settings.filter(
    (setting) => setting.isSensitive,
  ).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <AdministrationNav />

      <PageHeader
        title="Domain Settings"
        description="Current business, security and module configuration values."
        backHref="/administration"
        backLabel="Administration"
        actions={
          <Button
            nativeButton={false}
            render={<Link href="/administration/settings/edit" />}
          >
            <Pencil />
            Edit settings
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-8 md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Total settings</p>
          <p className="mt-1 text-2xl font-semibold">{settings.length}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="mt-1 text-2xl font-semibold">{activeCount}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Sensitive</p>
          <p className="mt-1 text-2xl font-semibold">{sensitiveCount}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Modules</p>
          <p className="mt-1 text-2xl font-semibold">
            {Object.keys(groupedSettings).length}
          </p>
        </div>
      </section>

      {settings.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No domain settings are configured.
        </p>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedSettings).map(
            ([moduleKey, moduleSettings]) => (
              <section key={moduleKey}>
                <div className="mb-4 flex items-center gap-2">
                  <Settings2 className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold tracking-wide uppercase">
                    {label(moduleKey)}
                  </h2>
                </div>

                <div className="divide-y divide-border/70">
                  {moduleSettings.map((setting) => (
                    <article
                      key={setting.id}
                      className="grid gap-5 py-5 lg:grid-cols-[1fr_12rem_12rem]"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium">{setting.name}</h3>

                          <Badge variant="outline">
                            {label(setting.dataType)}
                          </Badge>

                          <Badge
                            variant={recordStatusBadgeVariant(setting.status)}
                          >
                            {label(setting.status)}
                          </Badge>

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
                          <p className="text-xs text-muted-foreground">Value</p>

                          <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm font-medium">
                            {settingValue(setting)}
                          </pre>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">
                          Effective period
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {setting.effectiveFrom.toISOString().slice(0, 10)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          to{" "}
                          {setting.effectiveUntil?.toISOString().slice(0, 10) ??
                            "No end date"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Version</p>
                        <p className="mt-1 text-sm font-medium">
                          {setting.version}
                        </p>

                        <p className="mt-4 text-xs text-muted-foreground">
                          Last updated
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {setting.updatedAt
                            .toISOString()
                            .replace("T", " ")
                            .slice(0, 16)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="text-xs text-muted-foreground">
          Sensitive values are hidden and settings remain read-only until Edit
          is selected.
        </p>

        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href="/administration/settings/edit" />}
        >
          <Pencil />
          Edit settings
        </Button>
      </footer>
    </div>
  );
}
