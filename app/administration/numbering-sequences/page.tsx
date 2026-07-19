import Link from "next/link";
import type { Metadata } from "next";
import { Hash, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { activeStateBadgeVariant } from "@/src/config/ui-colors";
import { AdministrationNav } from "@/src/modules/admin/components/administration-nav";
import { getNumberingSequences } from "@/src/modules/admin/data/get-numbering-sequences";
import { previewNextReference } from "@/src/modules/admin/lib/numbering-sequence";

export const metadata: Metadata = {
  title: "Numbering Sequences",
};

export const dynamic = "force-dynamic";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function NumberingSequencesPage() {
  const sequences = await getNumberingSequences();

  const activeCount = sequences.filter((sequence) => sequence.isActive).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <AdministrationNav />

      <PageHeader
        title="Numbering Sequences"
        description="Current prefixes, starting values, number lengths, reset rules and reference previews."
        backHref="/administration"
        backLabel="Administration"
        actions={
          <Button
            nativeButton={false}
            render={<Link href="/administration/numbering-sequences/edit" />}
          >
            <Pencil />
            Edit sequences
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-8 md:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Configured</p>
          <p className="mt-1 text-2xl font-semibold">{sequences.length}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="mt-1 text-2xl font-semibold">{activeCount}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Inactive</p>
          <p className="mt-1 text-2xl font-semibold">
            {sequences.length - activeCount}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Hash className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Reference sequences
          </h2>
        </div>

        {sequences.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No numbering sequences are configured.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {sequences.map((sequence) => (
              <article key={sequence.id} className="py-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">
                        {label(sequence.sequenceCode)}
                      </h3>

                      <Badge variant="outline">{sequence.sequenceCode}</Badge>

                      <Badge
                        variant={activeStateBadgeVariant(sequence.isActive)}
                      >
                        {sequence.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <p className="mt-3 text-xs text-muted-foreground">
                      Next reference preview
                    </p>
                    <p className="mt-1 font-mono text-lg font-semibold">
                      {previewNextReference({
                        currentNumber: sequence.currentNumber,
                        minimumLength: sequence.minimumLength,
                        prefix: sequence.prefix,
                        suffix: sequence.suffix,
                      })}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Last issued number
                      </p>
                      <p className="mt-1 font-mono text-sm font-medium">
                        {sequence.currentNumber}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Prefix</p>
                      <p className="mt-1 font-mono text-sm font-medium">
                        {sequence.prefix || "None"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Suffix</p>
                      <p className="mt-1 font-mono text-sm font-medium">
                        {sequence.suffix || "None"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Minimum length
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {sequence.minimumLength}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Reset frequency
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {label(sequence.resetFrequency)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Last reset
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {sequence.lastResetAt
                          ? sequence.lastResetAt
                              .toISOString()
                              .replace("T", " ")
                              .slice(0, 16)
                          : "Never"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Version</p>
                      <p className="mt-1 text-sm font-medium">
                        {sequence.version}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="text-xs text-muted-foreground">
          Editing and reset controls are available only after selecting Edit.
        </p>

        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href="/administration/numbering-sequences/edit" />}
        >
          <Pencil />
          Edit sequences
        </Button>
      </footer>
    </div>
  );
}
