import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmployeeProfile } from "@/src/modules/hr/components/employee-profile";
import { getEmployeeProfile } from "@/src/modules/hr/data/get-employee-form-data";
import { getSelfServiceProfileExtras } from "@/src/modules/hr/data/get-self-service-profile-extras";
import { resolveEmployeeProfileAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Employee Profile",
};

export const dynamic = "force-dynamic";

type EmployeePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EmployeePage({ params }: EmployeePageProps) {
  const { id } = await params;
  const access = await resolveEmployeeProfileAccess(id);

  const [employee, extras] = await Promise.all([
    getEmployeeProfile(id),
    getSelfServiceProfileExtras(id),
  ]);

  if (!employee) {
    notFound();
  }

  return (
    <EmployeeProfile
      employee={employee}
      canManage={access.canManage}
      showPeopleNav={access.showPeopleNav}
      isOwnProfile={access.isOwnProfile}
      supervisor={extras.supervisor}
    />
  );
}
