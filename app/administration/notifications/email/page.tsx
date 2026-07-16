import type { Metadata } from "next";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Mail,
  RefreshCw,
  Server,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { activeStateBadgeVariant } from "@/src/config/ui-colors";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { createTestNotification } from "@/src/modules/admin/actions/create-test-notification";
import { processSystemEmailQueue } from "@/src/modules/admin/actions/manage-system-email";
import { AdministrationNav } from "@/src/modules/admin/components/administration-nav";
import { SystemEmailTestForm } from "@/src/modules/admin/components/system-email-test-form";
import { getEmailAdministrationData } from "@/src/modules/admin/data/get-email-administration";

export const metadata: Metadata = {
  title: "System Email",
};

export const dynamic = "force-dynamic";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function SystemEmailPage() {
  const data = await getEmailAdministrationData();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <AdministrationNav />

      <PageHeader
        title="System Email"
        description="SMTP configuration, delivery queue and system-wide notification email status."
        backHref="/administration"
        backLabel="Administration"
        actions={
          <form action={processSystemEmailQueue}>
            <Button type="submit" variant="outline">
              <RefreshCw />
              Process queue
            </Button>
          </form>
        }
      />

      <section className="grid grid-cols-2 gap-8 md:grid-cols-5">
        <div>
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="mt-1 text-2xl font-semibold">{data.totals.pending}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Processing</p>
          <p className="mt-1 text-2xl font-semibold">
            {data.totals.processing}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Sent</p>
          <p className="mt-1 text-2xl font-semibold">{data.totals.sent}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Failed</p>
          <p className="mt-1 text-2xl font-semibold">{data.totals.failed}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Cancelled</p>
          <p className="mt-1 text-2xl font-semibold">{data.totals.cancelled}</p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Server className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            SMTP status
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Delivery</p>
            <div className="mt-2">
              <Badge variant={activeStateBadgeVariant(data.smtp.enabled)}>
                {data.smtp.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">SMTP server</p>
            <p className="mt-1 text-sm font-medium">
              {data.smtp.host || "Not configured"}
              {data.smtp.host ? `:${data.smtp.port}` : ""}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Sender</p>
            <p className="mt-1 text-sm font-medium">
              {data.smtp.fromEmail || "Not configured"}
            </p>
          </div>
        </div>

        {data.smtp.configurationErrors.length > 0 && (
          <div className="mt-4 border-y border-destructive/40 py-4">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="size-4" />
              SMTP configuration requires attention
            </div>

            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {data.smtp.configurationErrors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Notification test
          </h2>
        </div>

        <div>
          <form action={createTestNotification}>
            <Button type="submit" variant="outline">
              <Bell />
              Create in-app and email notification
            </Button>
          </form>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Connection test
          </h2>
        </div>

        <div>
          <SystemEmailTestForm />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <CheckCircle2 className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Recent deliveries
          </h2>
        </div>

        {data.recent.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No system emails have been queued.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {data.recent.map((delivery) => (
              <article
                key={delivery.id}
                className="grid gap-5 py-5 md:grid-cols-[1fr_10rem_10rem]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{delivery.subject}</p>

                    <Badge
                      variant={
                        delivery.status === "SENT"
                          ? "success"
                          : delivery.status === "FAILED"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {label(delivery.status)}
                    </Badge>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {delivery.recipientName
                      ? `${delivery.recipientName} · `
                      : ""}
                    {delivery.recipientEmail}
                  </p>

                  {delivery.lastError && (
                    <p className="mt-2 text-xs text-destructive">
                      {delivery.lastError}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Attempts</p>
                  <p className="mt-1 text-sm font-medium">
                    {delivery.attemptCount} /{" "}
                    {delivery.maximumAttempts}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="mt-1 text-sm font-medium">
                    {new Date(delivery.createdAt).toLocaleString()}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
