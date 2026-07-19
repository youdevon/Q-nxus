"use client";

import { Printer, X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import type { EmployeeFilePrintPack } from "@/src/modules/hr/data/get-employee-file-print-pack";
import { checklistStatusLabel } from "@/src/modules/hr/lib/employee-file-checklist";
import {
  cxcGradeDisplayLabel,
  formatQualificationSubjectSummary,
  qualificationDocumentMetaParts,
  qualificationUsesSubjectEntries,
} from "@/src/modules/hr/lib/qualification-document-labels";
import { formatDisplayDate } from "@/src/lib/format";

function formatDate(value: string | null): string {
  return formatDisplayDate(value, { fallback: "—" });
}

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function EmployeeFilePrintView({ pack }: { pack: EmployeeFilePrintPack }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.print();
    }, 350);

    return () => window.clearTimeout(timer);
  }, []);

  const employeeName = `${pack.employee.firstName} ${pack.employee.lastName}`;

  return (
    <div className="min-h-full bg-muted/40 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3">
          <p className="truncate text-sm font-medium text-foreground">
            {employeeName} · Employee file pack
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Printer />
              Print
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => window.history.back()}
            >
              <X />
              Close
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[210mm] space-y-8 bg-white px-6 py-8 text-sm print:max-w-none print:px-0 print:py-0">
        <header className="space-y-1 border-b border-border pb-4">
          <h1 className="text-xl font-semibold tracking-tight">
            Employee file pack
          </h1>
          <p>
            {employeeName} · {pack.employee.employeeNumber}
          </p>
          <p className="text-muted-foreground">
            Printed {formatDate(pack.printedAt.slice(0, 10))}
            {pack.employee.departmentName
              ? ` · ${pack.employee.departmentName}`
              : ""}
          </p>
          <p className="text-muted-foreground">
            File completeness: {pack.checklist.completeCount} of{" "}
            {pack.checklist.totalCount} ({pack.checklist.percentComplete}%)
          </p>
        </header>

        <section>
          <h2 className="mb-3 text-xs font-semibold tracking-wide uppercase">
            Employment contracts
          </h2>
          {pack.contracts.length === 0 ? (
            <p className="text-muted-foreground">No contracts on file.</p>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-1.5 pr-3 font-medium">Title</th>
                  <th className="py-1.5 pr-3 font-medium">Status</th>
                  <th className="py-1.5 pr-3 font-medium">Dates</th>
                  <th className="py-1.5 font-medium">Document</th>
                </tr>
              </thead>
              <tbody>
                {pack.contracts.map((contract) => (
                  <tr key={contract.id} className="border-b border-border/60">
                    <td className="py-1.5 pr-3">
                      {contract.jobTitle}
                      {contract.isCurrent ? " · Current" : ""}
                      {contract.contractNumber
                        ? ` · ${contract.contractNumber}`
                        : ""}
                    </td>
                    <td className="py-1.5 pr-3">{label(contract.status)}</td>
                    <td className="py-1.5 pr-3">
                      {formatDate(contract.startDate)}
                      {" – "}
                      {formatDate(contract.endDate)}
                    </td>
                    <td className="py-1.5">
                      {contract.documentFileName ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold tracking-wide uppercase">
            Checklist
          </h2>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="py-1.5 pr-3 font-medium">Item</th>
                <th className="py-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {pack.checklist.items.map((item) => (
                <tr key={item.itemType} className="border-b border-border/60">
                  <td className="py-1.5 pr-3">{item.label}</td>
                  <td className="py-1.5">
                    {checklistStatusLabel(item.status)}
                    {item.linkedLabel ? ` · ${item.linkedLabel}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold tracking-wide uppercase">
            Letters
          </h2>
          {pack.letters.length === 0 ? (
            <p className="text-muted-foreground">No letters on file.</p>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-1.5 pr-3 font-medium">Title</th>
                  <th className="py-1.5 pr-3 font-medium">Status</th>
                  <th className="py-1.5 font-medium">Issued</th>
                </tr>
              </thead>
              <tbody>
                {pack.letters.map((letter) => (
                  <tr key={letter.id} className="border-b border-border/60">
                    <td className="py-1.5 pr-3">
                      {letter.title}
                      {!letter.employeeVisible ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (Confidential)
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-3">{label(letter.status)}</td>
                    <td className="py-1.5">{formatDate(letter.issueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold tracking-wide uppercase">
            Qualifications
          </h2>
          {pack.qualifications.length === 0 ? (
            <p className="text-muted-foreground">No qualifications on file.</p>
          ) : (
            <div className="space-y-4">
              {pack.qualifications.map((qualification) => (
                <div key={qualification.id}>
                  <p className="font-medium">
                    {qualification.title}
                    {!qualification.employeeVisible ? (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (Confidential)
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {qualificationDocumentMetaParts({
                      title: qualification.title,
                      documentType: qualification.documentType,
                      qualificationSubtype: qualification.qualificationSubtype,
                      customTypeLabel: qualification.customTypeLabel,
                      degreeType: qualification.degreeType,
                      programme: qualification.programme,
                      issuer: qualification.issuer,
                      year: qualification.year,
                    }).join(" · ")}
                    {!qualification.hasAttachment ? " · Missing proof" : ""}
                  </p>
                  {qualificationUsesSubjectEntries(qualification.documentType) &&
                  qualification.entries.length > 0 ? (
                    <p className="mt-1 text-sm">
                      {formatQualificationSubjectSummary(
                        qualification.entries,
                        {
                          documentType: qualification.documentType,
                          qualificationSubtype:
                            qualification.qualificationSubtype,
                        },
                      )}
                    </p>
                  ) : qualification.entries.length > 0 ? (
                    <ul className="mt-1 list-inside list-disc text-sm">
                      {qualification.entries.map((entry) => (
                        <li key={entry.id}>
                          {entry.subjectOrName}
                          {entry.gradeOrResult
                            ? ` — ${cxcGradeDisplayLabel(entry.gradeOrResult, {
                                documentType: qualification.documentType,
                                qualificationSubtype:
                                  qualification.qualificationSubtype,
                              })}`
                            : ""}
                          {entry.level ? ` (${entry.level})` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold tracking-wide uppercase">
            Credentials
          </h2>
          {pack.credentials.length === 0 ? (
            <p className="text-muted-foreground">No credentials on file.</p>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-1.5 pr-3 font-medium">Name</th>
                  <th className="py-1.5 pr-3 font-medium">Issuer</th>
                  <th className="py-1.5 font-medium">Expires</th>
                </tr>
              </thead>
              <tbody>
                {pack.credentials.map((credential) => (
                  <tr key={credential.id} className="border-b border-border/60">
                    <td className="py-1.5 pr-3">
                      {credential.name}
                      {!credential.employeeVisible ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (Confidential)
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-3">
                      {credential.issuer ?? "—"}
                    </td>
                    <td className="py-1.5">
                      {formatDate(credential.expiryDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold tracking-wide uppercase">
            Training
          </h2>
          {pack.trainingRecords.length === 0 ? (
            <p className="text-muted-foreground">No training records on file.</p>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-1.5 pr-3 font-medium">Course</th>
                  <th className="py-1.5 pr-3 font-medium">Completed</th>
                  <th className="py-1.5 font-medium">Expires</th>
                </tr>
              </thead>
              <tbody>
                {pack.trainingRecords.map((record) => (
                  <tr key={record.id} className="border-b border-border/60">
                    <td className="py-1.5 pr-3">
                      {record.courseName}
                      {!record.employeeVisible ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (Confidential)
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-3">
                      {formatDate(record.completedAt)}
                    </td>
                    <td className="py-1.5">
                      {formatDate(record.expiryDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
