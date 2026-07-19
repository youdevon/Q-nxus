import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FolderOpen } from "lucide-react";

import { PageShell } from "@/src/components/layout/page-shell";
import { PageAlert } from "@/src/components/ui/page-alert";
import { CorrespondenceList } from "@/src/modules/hr/components/correspondence-list";
import { EmployeeFileChecklist } from "@/src/modules/hr/components/employee-file-checklist";
import { EmployeeFileExtrasList } from "@/src/modules/hr/components/employee-file-extras-list";
import {
  EmployeeFileUpdateRequestsList,
  QualificationUpdateRequestForm,
} from "@/src/modules/hr/components/employee-file-update-requests";
import { MePageHeader } from "@/src/modules/hr/components/me-page-header";
import { getEmployeeCorrespondenceList } from "@/src/modules/hr/data/get-employee-correspondence";
import { getEmployeeFileChecklist } from "@/src/modules/hr/data/get-employee-file-checklist";
import { getEmployeeFileExtras } from "@/src/modules/hr/data/get-employee-file-extras";
import { getEmployeeFileUpdateRequests } from "@/src/modules/hr/data/get-employee-file-update-requests";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";
import { getEmployeeById } from "@/src/modules/hr/data/get-employee-form-data";
import { requiresEmployeeFile } from "@/src/modules/hr/lib/workforce-category";

export const metadata: Metadata = {
  title: "My Documents",
};

export const dynamic = "force-dynamic";

export default async function MyDocumentsPage() {
  const capabilities = await requireAuthenticatedCapabilities();

  if (
    !capabilities.can("people.profile.view_own") ||
    !capabilities.employeeId
  ) {
    redirect("/");
  }

  const profile = await getEmployeeById(capabilities.employeeId);
  if (!profile || !requiresEmployeeFile(profile.workforceCategory)) {
    redirect("/me");
  }

  const [list, extras, checklist, updateRequests] = await Promise.all([
    getEmployeeCorrespondenceList(capabilities.employeeId, {
      selfServiceOnly: true,
    }),
    getEmployeeFileExtras(capabilities.employeeId, { selfServiceOnly: true }),
    getEmployeeFileChecklist(capabilities.employeeId, {
      selfServiceOnly: true,
    }),
    getEmployeeFileUpdateRequests(capabilities.employeeId),
  ]);

  if (!list) {
    notFound();
  }

  return (
    <PageShell size="lg">
      <MePageHeader
        title="My documents"
        description={`Letters, credentials, and training on your employee file · ${list.employee.employeeNumber}`}
        backHref="/me"
        backLabel="My profile"
      />

      {list.pendingAcknowledgementCount > 0 ? (
        <PageAlert severity="warning" title="Acknowledgement needed">
          You have {list.pendingAcknowledgementCount} letter
          {list.pendingAcknowledgementCount === 1 ? "" : "s"} waiting for
          acknowledgement.
        </PageAlert>
      ) : null}

      {extras.expiringCredentialCount + extras.expiringTrainingCount > 0 ? (
        <PageAlert severity="warning" title="Expiring credentials or training">
          You have{" "}
          {extras.expiringCredentialCount + extras.expiringTrainingCount} item
          {extras.expiringCredentialCount + extras.expiringTrainingCount === 1
            ? ""
            : "s"}{" "}
          that expire within 30 days or have already expired.
        </PageAlert>
      ) : null}

      <section className="grid grid-cols-2 gap-8 md:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Visible letters</p>
          <p className="mt-1 text-2xl font-semibold">{list.items.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Needs acknowledgement</p>
          <p className="mt-1 text-2xl font-semibold">
            {list.pendingAcknowledgementCount}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Checklist</p>
          <p className="mt-1 text-2xl font-semibold">
            {checklist
              ? `${checklist.completeCount}/${checklist.totalCount}`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Credentials</p>
          <p className="mt-1 text-2xl font-semibold">
            {extras.credentials.length}
          </p>
        </div>
      </section>

      {checklist ? (
        <EmployeeFileChecklist
          employeeId={list.employee.id}
          checklist={checklist}
          canManage={false}
          readOnly
        />
      ) : null}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <FolderOpen className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Issued correspondence
          </h2>
        </div>

        <CorrespondenceList
          items={list.items}
          itemHref={(correspondenceId) => `/me/documents/${correspondenceId}`}
          emptyMessage="No letters have been issued to your file yet."
        />
      </section>

      <EmployeeFileExtrasList
        credentials={extras.credentials}
        trainingRecords={extras.trainingRecords}
        sections={["credentials", "training"]}
      />

      <EmployeeFileUpdateRequestsList
        requests={updateRequests}
        employeeId={list.employee.id}
      />

      <QualificationUpdateRequestForm />
    </PageShell>
  );
}
