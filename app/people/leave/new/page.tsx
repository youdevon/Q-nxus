import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { LeaveRequestForm } from "@/src/modules/hr/components/leave-request-form";
import { OnBehalfLeaveEmployeePicker } from "@/src/modules/hr/components/on-behalf-leave-employee-picker";
import { requireCurrentUser } from "@/src/modules/auth/data/get-current-user";
import {
  searchEmployeesForLeaveBalances,
} from "@/src/modules/hr/data/get-contract-leave-balances";
import { getNewLeaveRequestData } from "@/src/modules/hr/data/get-new-leave-request-data";
import { requireAuthenticatedCapabilities } from "@/src/modules/hr/data/require-people-access";
import { canRequestLeaveOnBehalf } from "@/src/modules/hr/lib/leave-request-mode";

export const metadata: Metadata = {
  title: "Request Leave for Employee",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  query?: string;
  employeeId?: string;
}>;

export default async function NewOnBehalfLeaveRequestPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [capabilities, params] = await Promise.all([
    requireAuthenticatedCapabilities(),
    searchParams,
  ]);

  if (!canRequestLeaveOnBehalf((code) => capabilities.can(code))) {
    // Legacy self-service bookmarks for /people/leave/new (and /leave/new).
    if (capabilities.can("leave.request")) {
      redirect("/me/leave/new");
    }

    notFound();
  }

  const query = params.query?.trim() ?? "";
  const employeeId = params.employeeId?.trim() ?? "";

  if (employeeId) {
    const user = await requireCurrentUser();
    const data = await getNewLeaveRequestData({
      employeeId,
      actingUserId: user.id,
      organizationId: user.organizationId,
      mode: "onBehalf",
    });

    if (!data) {
      notFound();
    }

    // On-behalf must pick another employee — never silently use self.
    if (
      capabilities.employeeId &&
      data.employee.id === capabilities.employeeId
    ) {
      redirect("/me/leave/new");
    }

    return <LeaveRequestForm data={data} />;
  }

  const matches = query
    ? (await searchEmployeesForLeaveBalances(query)).filter(
        (employee) => employee.id !== capabilities.employeeId,
      )
    : [];

  return (
    <OnBehalfLeaveEmployeePicker
      query={query}
      matches={matches}
      showNoMatches={Boolean(query) && matches.length === 0}
    />
  );
}
