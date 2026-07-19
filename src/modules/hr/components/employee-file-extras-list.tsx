import Link from "next/link";
import { Award, GraduationCap, ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDisplayDate } from "@/src/lib/format";
import type {
  CredentialListItem,
  QualificationDocumentListItem,
  TrainingListItem,
} from "@/src/modules/hr/data/get-employee-file-extras";
import {
  formatQualificationSubjectSummary,
  qualificationDocumentMetaParts,
  qualificationUsesSubjectEntries,
} from "@/src/modules/hr/lib/qualification-document-labels";

/** Display helper for credential / training / qualification dates. */
function formatDate(value: string): string {
  return formatDisplayDate(value);
}

function expiryBadge(status: CredentialListItem["expiryStatus"]) {
  switch (status) {
    case "EXPIRED":
      return <Badge variant="destructive">Expired</Badge>;
    case "EXPIRING":
      return <Badge variant="warning">Expiring soon</Badge>;
    default:
      return null;
  }
}

type EmployeeFileExtrasListProps = {
  credentials?: CredentialListItem[];
  trainingRecords?: TrainingListItem[];
  qualifications?: QualificationDocumentListItem[];
  credentialEditHref?: (id: string) => string;
  trainingEditHref?: (id: string) => string;
  qualificationEditHref?: (id: string) => string;
  showConfidentialBadge?: boolean;
  /** When set, only render these sections (default: all three). */
  sections?: ReadonlyArray<"qualifications" | "credentials" | "training">;
};

export function EmployeeFileExtrasList({
  credentials = [],
  trainingRecords = [],
  qualifications = [],
  credentialEditHref,
  trainingEditHref,
  qualificationEditHref,
  showConfidentialBadge = false,
  sections = ["qualifications", "credentials", "training"],
}: EmployeeFileExtrasListProps) {
  const showQualifications = sections.includes("qualifications");
  const showCredentials = sections.includes("credentials");
  const showTraining = sections.includes("training");

  return (
    <>
      {showQualifications ? (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <ScrollText className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Qualifications
            </h2>
          </div>

          {qualifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No qualifications on file.
            </p>
          ) : (
            <div className="divide-y divide-border/70">
              {qualifications.map((item) => {
                const meta = qualificationDocumentMetaParts({
                  title: item.title,
                  documentType: item.documentType,
                  qualificationSubtype: item.qualificationSubtype,
                  customTypeLabel: item.customTypeLabel,
                  degreeType: item.degreeType,
                  programme: item.programme,
                  issuer: item.issuer,
                  year: item.year,
                  issueDate: item.issueDate
                    ? formatDate(item.issueDate)
                    : null,
                }).join(" · ");

                const subjectSummary =
                  qualificationUsesSubjectEntries(item.documentType) &&
                  item.entries.length > 0
                    ? formatQualificationSubjectSummary(item.entries, {
                        documentType: item.documentType,
                        qualificationSubtype: item.qualificationSubtype,
                      })
                    : null;

                const titleBlock = (
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.title}</p>
                      {!item.hasAttachment ? (
                        <Badge variant="outline">Missing proof</Badge>
                      ) : null}
                      {showConfidentialBadge && !item.employeeVisible ? (
                        <Badge variant="outline">HR confidential</Badge>
                      ) : null}
                    </div>
                    {meta ? (
                      <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
                    ) : null}
                    {subjectSummary ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {subjectSummary}
                      </p>
                    ) : null}
                  </div>
                );

                return (
                  <div key={item.id} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {qualificationEditHref ? (
                        <Link
                          href={qualificationEditHref(item.id)}
                          className="min-w-0 flex-1 hover:underline"
                        >
                          {titleBlock}
                        </Link>
                      ) : (
                        titleBlock
                      )}
                      {item.downloadHref ? (
                        <Link
                          href={item.downloadHref}
                          className="text-sm font-medium underline underline-offset-2"
                        >
                          Download
                        </Link>
                      ) : null}
                    </div>

                    {showConfidentialBadge && item.notes ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        HR notes: {item.notes}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {showCredentials ? (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Award className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Credentials
            </h2>
          </div>

          {credentials.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No credentials on file.
            </p>
          ) : (
            <div className="divide-y divide-border/70">
              {credentials.map((item) => {
                const row = (
                  <div className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.name}</p>
                        {expiryBadge(item.expiryStatus)}
                        {showConfidentialBadge && !item.employeeVisible ? (
                          <Badge variant="outline">HR confidential</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[
                          item.issuer,
                          item.expiryDate
                            ? `Expires ${formatDate(item.expiryDate)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {item.downloadHref ? (
                      <Link
                        href={item.downloadHref}
                        className="text-sm font-medium underline underline-offset-2"
                      >
                        Download
                      </Link>
                    ) : null}
                  </div>
                );

                if (credentialEditHref) {
                  return (
                    <Link
                      key={item.id}
                      href={credentialEditHref(item.id)}
                      className="block hover:bg-muted/20"
                    >
                      {row}
                    </Link>
                  );
                }

                return <div key={item.id}>{row}</div>;
              })}
            </div>
          )}
        </section>
      ) : null}

      {showTraining ? (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <GraduationCap className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Training
            </h2>
          </div>

          {trainingRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No training records on file.
            </p>
          ) : (
            <div className="divide-y divide-border/70">
              {trainingRecords.map((item) => {
                const row = (
                  <div className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.courseName}</p>
                        {expiryBadge(item.expiryStatus)}
                        {showConfidentialBadge && !item.employeeVisible ? (
                          <Badge variant="outline">HR confidential</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[
                          item.provider,
                          `Completed ${formatDate(item.completedAt)}`,
                          item.expiryDate
                            ? `Expires ${formatDate(item.expiryDate)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {item.downloadHref ? (
                      <Link
                        href={item.downloadHref}
                        className="text-sm font-medium underline underline-offset-2"
                      >
                        Download
                      </Link>
                    ) : null}
                  </div>
                );

                if (trainingEditHref) {
                  return (
                    <Link
                      key={item.id}
                      href={trainingEditHref(item.id)}
                      className="block hover:bg-muted/20"
                    >
                      {row}
                    </Link>
                  );
                }

                return <div key={item.id}>{row}</div>;
              })}
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
