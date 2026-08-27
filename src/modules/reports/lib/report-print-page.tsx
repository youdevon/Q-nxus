import { getApplicationChrome } from "@/src/modules/admin/data/get-application-chrome";
import { ReportPrintView } from "@/src/modules/reports/components/report-print-view";
import { formatReportGeneratedAt } from "@/src/modules/reports/lib/report-print";

type ReportPrintPageProps = {
  title: string;
  metaLines?: string[];
  toolbarLabel?: string;
  children: React.ReactNode;
};

/** Server wrapper for report print routes — minimal chrome, auto-print on load. */
export async function ReportPrintPage({
  title,
  metaLines,
  toolbarLabel,
  children,
}: ReportPrintPageProps) {
  const chrome = await getApplicationChrome();
  const generatedAt = formatReportGeneratedAt(new Date());

  return (
    <ReportPrintView
      title={title}
      organizationName={chrome.organizationName}
      metaLines={metaLines}
      generatedAtLabel={generatedAt}
      toolbarLabel={toolbarLabel}
    >
      {children}
    </ReportPrintView>
  );
}
