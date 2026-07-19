import Link from "next/link";
import type { Metadata } from "next";
import { FileText, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { getCorrespondenceTemplates } from "@/src/modules/hr/data/get-correspondence-templates";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Letter Templates",
};

export const dynamic = "force-dynamic";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function CorrespondenceTemplatesPage() {
  const capabilities = await requirePeopleManageAccess();
  const user = await prisma.user.findUnique({
    where: { id: capabilities.userId },
    select: { organizationId: true },
  });

  if (!user) {
    return null;
  }

  const templates = await getCorrespondenceTemplates(user.organizationId);

  return (
    <PageShell size="lg">
      <PeoplePageHeader
        title="Letter templates"
        description="Reusable correspondence with merge placeholders"
        backHref="/people/documents"
        backLabel="Documents"
        actions={
          <Button
            nativeButton={false}
            render={<Link href="/people/documents/templates/new" />}
          >
            <Plus />
            New template
          </Button>
        }
      />

      <section>
        {templates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <FileText className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No templates yet. Create one to pre-fill new letters.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {templates.map((template) => (
              <Link
                key={template.id}
                href={`/people/documents/templates/${template.id}/edit`}
                className="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-muted/20"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{template.name}</p>
                    <Badge variant="outline">{label(template.category)}</Badge>
                    {!template.isActive ? (
                      <Badge variant="secondary">Inactive</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {template.defaultTitle}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
