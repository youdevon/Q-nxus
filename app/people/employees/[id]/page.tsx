import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { EmployeeLifecyclePanel } from "@/src/modules/hr/components/employee-lifecycle-panel";
import { EmployeeProfile } from "@/src/modules/hr/components/employee-profile";
import { getEmployeeProfile } from "@/src/modules/hr/data/get-employee-form-data";
import { getEmployeeFileChecklist } from "@/src/modules/hr/data/get-employee-file-checklist";
import { getSelfServiceProfileExtras } from "@/src/modules/hr/data/get-self-service-profile-extras";
import { resolveEmployeeProfileAccess } from "@/src/modules/hr/data/require-people-access";
import { suggestMissingEmployeeFileItems } from "@/src/modules/hr/lib/compliance-packs";
import { requiresEmployeeFile } from "@/src/modules/hr/lib/workforce-category";
import { getEmployeeLifecycleCases } from "@/src/modules/hr/services/employee-lifecycle-cases";

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

  const [employee, extras, checklist, lifecycle, activeContractCount, contracts] =
    await Promise.all([
      getEmployeeProfile(id),
      getSelfServiceProfileExtras(id),
      access.canManage ? getEmployeeFileChecklist(id) : Promise.resolve(null),
      access.canManage
        ? getEmployeeLifecycleCases(id)
        : Promise.resolve({ onboarding: [], offboarding: [] }),
      access.canManage
        ? prisma.employmentContract.count({
            where: {
              employeeId: id,
              isCurrent: true,
              status: "ACTIVE",
            },
          })
        : Promise.resolve(0),
      access.canManage
        ? prisma.employmentContract.findMany({
            where: { employeeId: id },
            orderBy: [{ isCurrent: "desc" }, { updatedAt: "desc" }],
            select: {
              id: true,
              status: true,
              isCurrent: true,
            },
          })
        : Promise.resolve([]),
    ]);

  if (!employee) {
    notFound();
  }

  const activatableContractId =
    contracts.find((row) =>
      ["DRAFT", "APPROVED", "AWAITING_SIGNATURE", "PENDING_APPROVAL"].includes(
        row.status,
      ),
    )?.id ?? null;
  const currentContractId =
    contracts.find((row) => row.isCurrent)?.id ?? null;

  const showFileCompleteness =
    access.canManage &&
    requiresEmployeeFile(employee.workforceCategory) &&
    checklist != null;

  const suggestions =
    access.canManage && checklist
      ? suggestMissingEmployeeFileItems({
          hasActiveContract: activeContractCount > 0,
          checklistMissingLabels: checklist.missingLabels,
          openUpdateRequestCount: 0,
        })
      : [];

  return (
    <>
      <EmployeeProfile
        employee={employee}
        canManage={access.canManage}
        canManageAccess={access.capabilities.canAny(
          "administration.manage",
          "identity.user.update",
          "identity.role.manage",
        )}
        showPeopleNav={access.showPeopleNav}
        isOwnProfile={access.isOwnProfile}
        supervisor={extras.supervisor}
        fileCompleteness={
          showFileCompleteness
            ? {
                completeCount: checklist.completeCount,
                totalCount: checklist.totalCount,
                percentComplete: checklist.percentComplete,
                isComplete: checklist.isComplete,
                missingLabels: checklist.missingLabels,
              }
            : null
        }
      />

      {access.canManage ? (
        <div className="mx-auto w-full max-w-5xl px-4 pb-8">
          <EmployeeLifecyclePanel
            employeeId={id}
            canManage
            activatableContractId={activatableContractId}
            currentContractId={currentContractId}
            onboarding={lifecycle.onboarding.map((row) => ({
              id: row.id,
              status: row.status,
              caseNumber: row.caseNumber,
              caseType: row.caseType,
              progressPercent: Math.round(
                (row.tasks.filter(
                  (task) =>
                    task.status === "COMPLETED" || task.status === "SKIPPED",
                ).length /
                  Math.max(row.tasks.length, 1)) *
                  100,
              ),
              tasks: row.tasks.map((task) => ({
                id: task.id,
                code: task.code,
                label: task.label,
                status: task.status,
                dueAt: task.dueAt?.toISOString() ?? null,
                assigneeUserId: task.assigneeUserId,
                assigneeName: task.assignee
                  ? `${task.assignee.firstName} ${task.assignee.lastName}`.trim()
                  : null,
                notes: task.notes,
              })),
            }))}
            offboarding={lifecycle.offboarding.map((row) => ({
              id: row.id,
              status: row.status,
              caseNumber: row.caseNumber,
              reasonCode: row.reasonCode,
              reason: row.reason,
              progressPercent: Math.round(
                (row.tasks.filter(
                  (task) =>
                    task.status === "COMPLETED" || task.status === "SKIPPED",
                ).length /
                  Math.max(row.tasks.length, 1)) *
                  100,
              ),
              tasks: row.tasks.map((task) => ({
                id: task.id,
                code: task.code,
                label: task.label,
                status: task.status,
                dueAt: task.dueAt?.toISOString() ?? null,
                assigneeUserId: task.assigneeUserId,
                assigneeName: task.assignee
                  ? `${task.assignee.firstName} ${task.assignee.lastName}`.trim()
                  : null,
                notes: task.notes,
              })),
            }))}
          />

          {suggestions.length > 0 ? (
            <section className="border-y border-border py-5">
              <h2 className="text-sm font-semibold tracking-wide uppercase">
                Suggested next steps
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {suggestions.slice(0, 6).map((item) => (
                  <li key={`${item.code}-${item.label}`}>
                    <span className="font-medium">{item.label}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      — {item.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
