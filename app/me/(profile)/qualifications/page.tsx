import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EmployeeFileExtrasList } from "@/src/modules/hr/components/employee-file-extras-list";
import {
  EmployeeFileUpdateRequestsList,
  QualificationUpdateRequestForm,
} from "@/src/modules/hr/components/employee-file-update-requests";
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
    <>
      <EmployeeFileExtrasList
        qualifications={extras.qualifications}
        sections={["qualifications"]}
      />

      <EmployeeFileUpdateRequestsList
        requests={updateRequests}
        employeeId={employeeId}
      />

      <QualificationUpdateRequestForm />
    </>
  );
}
