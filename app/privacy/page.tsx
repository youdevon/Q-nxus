import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/src/components/layout/page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { getApplicationChrome } from "@/src/modules/admin/data/get-application-chrome";
import { getCurrentUser } from "@/src/modules/auth/data/get-current-user";
import {
  PERSONAL_DATA_PROCESSING_PURPOSES,
  TT_DATA_RETENTION_GUIDANCE,
} from "@/src/modules/hr/lib/data-retention-guidance";

export const metadata: Metadata = {
  title: "Privacy notice",
};

export const dynamic = "force-dynamic";

export default async function PrivacyNoticePage() {
  const [user, chrome] = await Promise.all([
    getCurrentUser(),
    getApplicationChrome(),
  ]);

  const orgName = chrome.organizationName || chrome.displayName || "the organization";

  return (
    <PageShell size="md" className={user ? undefined : "py-10"}>
      <PageHeader
        title="Privacy notice"
        description={`How ${orgName} uses personal information in this workforce system.`}
      />

      <section className="space-y-3 text-sm leading-relaxed text-foreground">
        <h2 className="text-base font-semibold">Who this covers</h2>
        <p className="text-muted-foreground">
          This notice describes processing of employee and related personal data
          in Q-NXUS for employment, payroll, and workplace operations. It is a
          product notice for transparency — not legal advice. Your employer (the
          data controller) remains responsible for lawful processing.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-base font-semibold">Why we process personal data</h2>
        <ul className="space-y-3">
          {PERSONAL_DATA_PROCESSING_PURPOSES.map((item) => (
            <li key={item.purpose}>
              <p className="font-medium text-foreground">{item.purpose}</p>
              <p className="text-muted-foreground">{item.examples}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-base font-semibold">Typical categories</h2>
        <p className="text-muted-foreground">
          Identity and contact details; employment and contract records; leave
          and documents; payroll and statutory identifiers (such as NIS/BIR);
          bank payment details (account numbers encrypted at rest); performance
          and correspondence records; and security/audit metadata.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-base font-semibold">Retention (guidance)</h2>
        <p className="text-muted-foreground">
          Default product guidance for Trinidad &amp; Tobago employment and
          payroll records (confirm with your counsel):
        </p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            Payroll / payslip records: about{" "}
            {TT_DATA_RETENTION_GUIDANCE.payrollYears} years
          </li>
          <li>
            Employee master file after exit: about{" "}
            {TT_DATA_RETENTION_GUIDANCE.employeeMasterYearsAfterExit} years
          </li>
          <li>
            Leave attachments: about{" "}
            {TT_DATA_RETENTION_GUIDANCE.leaveAttachmentYears} years
          </li>
          <li>
            Archived file binaries may be purged{" "}
            {TT_DATA_RETENTION_GUIDANCE.archivedFileBinaryPurgeDays} days after
            soft-archive (unless on legal hold)
          </li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-base font-semibold">Your access in this system</h2>
        <p className="text-muted-foreground">
          Signed-in employees can review much of their own profile, leave,
          documents, contracts, and released payslips under My Profile. Corrections
          to personal details are usually requested through HR. Erasure may be
          limited where payroll or labour law requires continued retention.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-base font-semibold">Security</h2>
        <p className="text-muted-foreground">
          Access is role-based and organization-scoped. Bank account numbers are
          encrypted at rest. Database connections in production require TLS.
          Significant changes may be recorded in audit logs.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        Questions about your data should go to your HR or system administrator
        for {orgName}.
      </p>

      {!user ? (
        <p className="text-sm">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      ) : (
        <p className="text-sm">
          <Link href="/" className="text-primary underline-offset-4 hover:underline">
            Back to home
          </Link>
        </p>
      )}
    </PageShell>
  );
}
