import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  Award,
  FileSignature,
  FolderOpen,
  GraduationCap,
  Plus,
  Printer,
  ScrollText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageActionsEnd } from "@/src/components/layout/page-actions";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { PageAlert } from "@/src/components/ui/page-alert";
import { CorrespondenceList } from "@/src/modules/hr/components/correspondence-list";
import { EmployeeFileChecklist } from "@/src/modules/hr/components/employee-file-checklist";
import {
  EmployeeFileCompletenessBar,
  EmployeeFileCompletenessWarning,
} from "@/src/modules/hr/components/employee-file-completeness";
import { EmployeeFileExtrasList } from "@/src/modules/hr/components/employee-file-extras-list";
import { EmployeeFileUpdateRequestsList } from "@/src/modules/hr/components/employee-file-update-requests";
import { getEmployeeCorrespondenceList } from "@/src/modules/hr/data/get-employee-correspondence";
import { getEmployeeFileChecklist } from "@/src/modules/hr/data/get-employee-file-checklist";
import { getEmployeeFileExtras } from "@/src/modules/hr/data/get-employee-file-extras";
import { getEmployeeFileUpdateRequests } from "@/src/modules/hr/data/get-employee-file-update-requests";
import { getEmployeeById } from "@/src/modules/hr/data/get-employee-form-data";
import { getEmployeeContractHistory } from "@/src/modules/hr/data/get-employment-contracts";
import { resolveEmployeeCorrespondenceAccess } from "@/src/modules/hr/data/require-people-access";
import { contractStatusLabel } from "@/src/modules/hr/lib/contract-lifecycle";
import { requiresEmployeeFile } from "@/src/modules/hr/lib/workforce-category";
import { formatDisplayDate } from "@/src/lib/format";

export const metadata: Metadata = {
  title: "Employee File",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  category?: string;
  status?: string;
  subType?: string;
  overdueAck?: string;
  expiringRetention?: string;
}>;

export default async function EmployeeDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{
    id: string;
  }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const access = await resolveEmployeeCorrespondenceAccess(id);
  const query = await searchParams;

  if (access.isSelfService) {
    notFound();
  }

  const employee = await getEmployeeById(id);
  if (!employee || !requiresEmployeeFile(employee.workforceCategory)) {
    redirect(`/people/employees/${id}`);
  }

  const filters = {
    category: query.category,
    status: query.status,
    subType: query.subType,
    overdueAck: query.overdueAck === "1",
    expiringRetention: query.expiringRetention === "1",
  };

  const [list, extras, checklist, updateRequests, contractHistory] =
    await Promise.all([
      getEmployeeCorrespondenceList(id, {
        managerView: access.isManagerView,
        filters: access.canManage ? filters : undefined,
      }),
      access.canManage || access.isManagerView
        ? getEmployeeFileExtras(id, {
            selfServiceOnly: access.isManagerView,
          })
        : Promise.resolve(null),
      access.canManage || access.isManagerView
        ? getEmployeeFileChecklist(id, {
            selfServiceOnly: access.isManagerView,
          })
        : Promise.resolve(null),
      access.canManage
        ? getEmployeeFileUpdateRequests(id)
        : Promise.resolve([]),
      access.canManage || access.isManagerView
        ? getEmployeeContractHistory(id)
        : Promise.resolve(null),
    ]);

  if (!list) {
    notFound();
  }

  const profileHref = `/people/employees/${list.employee.id}`;
  const baseHref = `/people/employees/${list.employee.id}/documents`;

  return (
    <PageShell size="lg">
      <PeoplePageHeader
        title="Employee file"
        description={`${list.employee.firstName} ${list.employee.lastName} · ${list.employee.employeeNumber}${
          access.isManagerView ? " · Manager view" : ""
        }`}
        backHref={profileHref}
        backLabel="Employee"
        actions={
          access.canManage ? (
            <PageActionsEnd>
              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link
                    href={`/people/employees/${list.employee.id}/documents/print`}
                    target="_blank"
                  />
                }
              >
                <Printer />
                Print file pack
              </Button>
              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link
                    href={`/people/employees/${list.employee.id}/qualifications/new`}
                  />
                }
              >
                <ScrollText />
                Add qualification
              </Button>
              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link
                    href={`/people/employees/${list.employee.id}/credentials/new`}
                  />
                }
              >
                <Award />
                Add credential
              </Button>
              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link
                    href={`/people/employees/${list.employee.id}/training/new`}
                  />
                }
              >
                <GraduationCap />
                Add training
              </Button>
              <Button
                nativeButton={false}
                render={
                  <Link
                    href={`/people/employees/${list.employee.id}/documents/new`}
                  />
                }
              >
                <Plus />
                New letter
              </Button>
            </PageActionsEnd>
          ) : undefined
        }
      />

      {access.isManagerView ? (
        <PageAlert severity="information" title="Manager access">
          You can view letters shared with managers for this direct report.
        </PageAlert>
      ) : null}

      {access.canManage && checklist && !checklist.isComplete ? (
        <EmployeeFileCompletenessWarning
          completeCount={checklist.completeCount}
          totalCount={checklist.totalCount}
          missingLabels={checklist.missingLabels}
          documentsHref={baseHref}
        />
      ) : null}

      <section className="grid grid-cols-2 gap-8 md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Letters</p>
          <p className="mt-1 text-2xl font-semibold">{list.items.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Draft</p>
          <p className="mt-1 text-2xl font-semibold">
            {list.items.filter((item) => item.status === "DRAFT").length}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Overdue ack</p>
          <p className="mt-1 text-2xl font-semibold">
            {list.overdueAcknowledgementCount}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">File completeness</p>
          {checklist ? (
            <div className="mt-2">
              <EmployeeFileCompletenessBar
                completeCount={checklist.completeCount}
                totalCount={checklist.totalCount}
                percentComplete={checklist.percentComplete}
              />
            </div>
          ) : (
            <p className="mt-1 text-2xl font-semibold">—</p>
          )}
        </div>
      </section>

      {access.canManage ? (
        <section className="flex flex-wrap gap-2 text-sm">
          <Link
            href={baseHref}
            className="rounded-md border px-3 py-1.5 hover:bg-muted/40"
          >
            All
          </Link>
          <Link
            href={`${baseHref}?overdueAck=1`}
            className="rounded-md border px-3 py-1.5 hover:bg-muted/40"
          >
            Overdue acknowledgements
          </Link>
          <Link
            href={`${baseHref}?expiringRetention=1`}
            className="rounded-md border px-3 py-1.5 hover:bg-muted/40"
          >
            Expiring retention
          </Link>
          <Link
            href={`${baseHref}?category=POLICY`}
            className="rounded-md border px-3 py-1.5 hover:bg-muted/40"
          >
            Policy
          </Link>
        </section>
      ) : null}

      {checklist ? (
        <EmployeeFileChecklist
          employeeId={list.employee.id}
          checklist={checklist}
          canManage={access.canManage}
          readOnly={access.isManagerView}
        />
      ) : null}

      {contractHistory ? (
        <section>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileSignature className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold tracking-wide uppercase">
                Contracts
              </h2>
            </div>
            {access.canManage ? (
              <Button
                nativeButton={false}
                variant="outline"
                size="sm"
                render={
                  <Link
                    href={`/people/employees/${list.employee.id}/contracts`}
                  />
                }
              >
                View all
              </Button>
            ) : null}
          </div>
          {contractHistory.contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No employment contracts on file.
            </p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {contractHistory.contracts.slice(0, 5).map((contract) => (
                <li key={contract.id} className="py-3">
                  <Link
                    href={`/people/employees/${list.employee.id}/contracts/${contract.id}`}
                    className="block hover:underline"
                  >
                    <p className="text-sm font-medium">
                      {contract.jobTitle}
                      {contract.isCurrent ? " · Current" : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {contractStatusLabel(contract.status)} ·{" "}
                      {formatDisplayDate(contract.startDate)} –{" "}
                      {formatDisplayDate(contract.endDate, { fallback: "Open" })}
                      {contract.documentReference
                        ? ` · ${contract.documentReference}`
                        : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {access.canManage ? (
        <EmployeeFileUpdateRequestsList
          requests={updateRequests}
          canManage
          employeeId={list.employee.id}
        />
      ) : null}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <FolderOpen className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Correspondence
          </h2>
        </div>

        <CorrespondenceList
          items={list.items}
          itemHref={(correspondenceId) =>
            `/people/employees/${list.employee.id}/documents/${correspondenceId}`
          }
          emptyMessage={
            access.isManagerView
              ? "No manager-visible letters have been shared for this employee."
              : "No correspondence has been filed for this employee."
          }
          showConfidentialBadge={access.canManage}
        />
      </section>

      {extras ? (
        <EmployeeFileExtrasList
          credentials={extras.credentials}
          trainingRecords={extras.trainingRecords}
          qualifications={extras.qualifications}
          showConfidentialBadge={access.canManage}
          credentialEditHref={
            access.canManage
              ? (credentialId) =>
                  `/people/employees/${list.employee.id}/credentials/${credentialId}/edit`
              : undefined
          }
          trainingEditHref={
            access.canManage
              ? (trainingId) =>
                  `/people/employees/${list.employee.id}/training/${trainingId}/edit`
              : undefined
          }
          qualificationEditHref={
            access.canManage
              ? (documentId) =>
                  `/people/employees/${list.employee.id}/qualifications/${documentId}/edit`
              : undefined
          }
        />
      ) : null}
    </PageShell>
  );
}
