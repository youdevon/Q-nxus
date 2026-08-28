import Link from "next/link";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { ReportDownloadButton } from "@/src/modules/reports/components/report-download-button";

type ReportLayoutProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
};

export function ReportLayout({
  title,
  description,
  children,
  filters,
  actions,
  backHref = "/reports",
  backLabel = "Reports",
}: ReportLayoutProps) {
  return (
    <PageShell size="lg">
      <PageHeader
        title={title}
        description={description}
        backHref={backHref}
        backLabel={backLabel}
        actions={actions}
      />

      {filters ? <div className="mb-8">{filters}</div> : null}

      {children}
    </PageShell>
  );
}

export function ReportCsvLink({
  href,
  label = "Download CSV",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Button nativeButton={false} variant="outline" render={<Link href={href} />}>
      {label}
    </Button>
  );
}

export function ReportXlsxLink({
  href,
  label = "Download XLSX",
}: {
  href: string;
  label?: string;
}) {
  return <ReportDownloadButton href={href} label={label} />;
}

function withXlsxFormat(href: string): string {
  return href.includes("?") ? `${href}&format=xlsx` : `${href}?format=xlsx`;
}

export function ReportExportLinks({ href }: { href: string }) {
  return (
    <>
      <ReportCsvLink href={href} />
      <ReportXlsxLink href={withXlsxFormat(href)} />
    </>
  );
}

export function ReportPrintLink({
  href,
  label = "Print",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Button
      nativeButton={false}
      variant="outline"
      render={<Link href={href} target="_blank" rel="noopener noreferrer" />}
    >
      <Printer />
      {label}
    </Button>
  );
}

export function ReportEmptyState({
  message,
  hint,
}: {
  message: string;
  hint?: string;
}) {
  return (
    <div className="py-12 text-center text-sm text-muted-foreground">
      <p>{message}</p>
      {hint ? <p className="mx-auto mt-2 max-w-md text-xs">{hint}</p> : null}
    </div>
  );
}

export function ReportGenerateButton({
  label = "Generate report",
}: {
  label?: string;
}) {
  return <Button type="submit">{label}</Button>;
}

export function ReportSummaryGrid({
  items,
}: {
  items: Array<{ label: string; value: string | number }>;
}) {
  return (
    <section className="mb-8 grid grid-cols-2 gap-8 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</p>
        </div>
      ))}
    </section>
  );
}
