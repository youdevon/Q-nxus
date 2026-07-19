import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell } from "@/src/components/layout/page-shell";
import { EmployeeFileExtrasList } from "@/src/modules/hr/components/employee-file-extras-list";
import {
  EmployeeFileUpdateRequestsList,
  QualificationUpdateRequestForm,
} from "@/src/modules/hr/components/employee-file-update-requests";
import { MePageHeader } from "@/src/modules/hr/components/me-page-header";
import { getEmployeeFileExtras } from "@/src/modules/hr/data/get-employee-file-extras";
import { getEmployeeFileUpdateRequests } from "@/src/modules/hr/data/get-employee-file-update-requests";
import { getEmployeeProfile } from "@/src/modules/hr/data/get-employee-form-data";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";
import { requiresEmployeeFile } from "@/src/modules/hr/lib/workforce-category";

export const metadata: Metadata = {
  title: "My Qualifications",
};

export const dynamic = "force-dynamic";

export default async function MyQualificationsPage() {
  const capabilities = await requireAuthenticatedCapabilities();

  if (
    !capabilities.can("people.profile.view_own") ||
    !capabilities.employeeId
  ) {
    redirect("/");
  }

  const employeeId = capabilities.employeeId;
  const [employee, extras, updateRequests] = await Promise.all([
    getEmployeeProfile(employeeId),
    getEmployeeFileExtras(employeeId, { selfServiceOnly: true }),
    getEmployeeFileUpdateRequests(employeeId),
  ]);

  if (!employee || !requiresEmployeeFile(employee.workforceCategory)) {
    redirect("/me");
  }

  return (
    <PageShell size="lg">
      <MePageHeader
        title="My qualifications"
        description={`Qualifications on your employee file · ${employee.employeeNumber}`}
        backHref="/me"
        backLabel="My profile"
      />

      <EmployeeFileExtrasList
        qualifications={extras.qualifications}
        sections={["qualifications"]}
      />

      <EmployeeFileUpdateRequestsList
        requests={updateRequests}
        employeeId={employeeId}
      />

      <QualificationUpdateRequestForm />
    </PageShell>
  );
}
