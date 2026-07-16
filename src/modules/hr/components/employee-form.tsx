"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Save, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/src/components/layout/page-header";
import {
  PageActionsEnd,
  PageActionsStart,
} from "@/src/components/layout/page-actions";
import { PageShell } from "@/src/components/layout/page-shell";
import {
  createEmployee,
  updateEmployee,
  type EmployeeFormState,
} from "@/src/modules/hr/actions/save-employee";
import type {
  EmployeeFormDepartment,
  EmployeeFormRecord,
} from "@/src/modules/hr/data/get-employee-form-data";
import { PeopleNav } from "./people-nav";

type EmployeeFormProps = {
  employee?: EmployeeFormRecord;
  departments: EmployeeFormDepartment[];
};

const initialState: EmployeeFormState = {
  status: "idle",
  message: "",
};

export function EmployeeForm({ employee, departments }: EmployeeFormProps) {
  const action = employee ? updateEmployee : createEmployee;
  const [state, formAction, pending] = useActionState(action, initialState);

  const [departmentId, setDepartmentId] = useState(
    employee?.departmentId ?? "",
  );

  const positions = useMemo(
    () =>
      departments.find((department) => department.id === departmentId)
        ?.positions ?? [],
    [departmentId, departments],
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "conflict") {
      toast.warning(state.message);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <PageShell>
        <PeopleNav />

        <PageHeader
          title={
            employee
              ? `${employee.firstName} ${employee.lastName}`
              : "New Employee"
          }
          description={
            employee
              ? `Manage employee ${employee.employeeNumber}.`
              : "Create a workforce profile and assign an employment classification."
          }
          backHref={employee ? `/people/employees/${employee.id}` : "/people"}
          backLabel={employee ? "Employee" : "Employees"}
          actions={
            <>
              <PageActionsStart>
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={
                    <Link
                      href={
                        employee
                          ? `/people/employees/${employee.id}`
                          : "/people"
                      }
                    />
                  }
                >
                  {employee ? "Cancel" : "Directory"}
                </Button>

                {employee && (
                  <Button
                    nativeButton={false}
                    variant="outline"
                    render={
                      <Link
                        href={`/people/employees/${employee.id}/job-description`}
                      />
                    }
                  >
                    Job description
                  </Button>
                )}
              </PageActionsStart>

              <PageActionsEnd>
                <Button type="submit" disabled={pending}>
                  <Save />
                  {pending
                    ? "Saving…"
                    : employee
                      ? "Save employee"
                      : "Create employee"}
                </Button>
              </PageActionsEnd>
            </>
          }
        />

        {employee && (
          <>
            <input type="hidden" name="id" value={employee.id} />
            <input type="hidden" name="updatedAt" value={employee.updatedAt} />

            <div className="flex flex-wrap items-center gap-2">
              <UserRound className="size-4 text-muted-foreground" />
              <span className="font-mono text-sm font-medium">
                {employee.employeeNumber}
              </span>
              <Badge variant="outline">
                {employee.employmentStatus.replaceAll("_", " ").toLowerCase()}
              </Badge>
            </div>
          </>
        )}

        {state.status !== "idle" && (
          <div
            role="alert"
            className="border-y border-destructive/40 bg-destructive/5 py-3 text-sm text-destructive"
          >
            {state.message}
          </div>
        )}

        <section>
          <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
            Personal details
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="text-sm font-medium">
                First name
              </label>
              <Input
                id="firstName"
                name="firstName"
                defaultValue={employee?.firstName ?? ""}
                className="mt-2"
                required
              />
              {state.fieldErrors?.firstName && (
                <p className="mt-1 text-xs text-destructive">
                  {state.fieldErrors.firstName}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="middleName" className="text-sm font-medium">
                Middle name
              </label>
              <Input
                id="middleName"
                name="middleName"
                defaultValue={employee?.middleName ?? ""}
                className="mt-2"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="text-sm font-medium">
                Last name
              </label>
              <Input
                id="lastName"
                name="lastName"
                defaultValue={employee?.lastName ?? ""}
                className="mt-2"
                required
              />
              {state.fieldErrors?.lastName && (
                <p className="mt-1 text-xs text-destructive">
                  {state.fieldErrors.lastName}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="preferredName" className="text-sm font-medium">
                Preferred name
              </label>
              <Input
                id="preferredName"
                name="preferredName"
                defaultValue={employee?.preferredName ?? ""}
                className="mt-2"
              />
            </div>

            <div>
              <label htmlFor="dateOfBirth" className="text-sm font-medium">
                Date of birth
              </label>
              <Input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                defaultValue={employee?.dateOfBirth ?? ""}
                className="mt-2"
              />
              {state.fieldErrors?.dateOfBirth && (
                <p className="mt-1 text-xs text-destructive">
                  {state.fieldErrors.dateOfBirth}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="text-sm font-medium">
                Phone
              </label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={employee?.phone ?? ""}
                className="mt-2"
              />
            </div>

            <div>
              <label htmlFor="personalEmail" className="text-sm font-medium">
                Personal email
              </label>
              <Input
                id="personalEmail"
                name="personalEmail"
                type="email"
                defaultValue={employee?.personalEmail ?? ""}
                className="mt-2"
              />
              {state.fieldErrors?.personalEmail && (
                <p className="mt-1 text-xs text-destructive">
                  {state.fieldErrors.personalEmail}
                </p>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
            Employment details
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="workEmail" className="text-sm font-medium">
                Work email
              </label>
              <Input
                id="workEmail"
                name="workEmail"
                type="email"
                defaultValue={employee?.workEmail ?? ""}
                className="mt-2"
              />
              {state.fieldErrors?.workEmail && (
                <p className="mt-1 text-xs text-destructive">
                  {state.fieldErrors.workEmail}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="employmentType" className="text-sm font-medium">
                Employment type
              </label>
              <select
                id="employmentType"
                name="employmentType"
                defaultValue={employee?.employmentType ?? "PERMANENT"}
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                required
              >
                <option value="PERMANENT">Permanent</option>
                <option value="CONTRACT">Contract</option>
                <option value="TEMPORARY">Temporary</option>
                <option value="PART_TIME">Part time</option>
                <option value="INTERN">Intern</option>
                <option value="CONSULTANT">Consultant</option>
              </select>
            </div>

            <div>
              <label htmlFor="employmentStatus" className="text-sm font-medium">
                Employment status
              </label>
              <select
                id="employmentStatus"
                name="employmentStatus"
                defaultValue={employee?.employmentStatus ?? "ACTIVE"}
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                required
              >
                <option value="ACTIVE">Active</option>
                <option value="ON_LEAVE">On leave</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="TERMINATED">Terminated</option>
                <option value="RETIRED">Retired</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div>
              <label htmlFor="hireDate" className="text-sm font-medium">
                Hire date
              </label>
              <Input
                id="hireDate"
                name="hireDate"
                type="date"
                defaultValue={employee?.hireDate ?? ""}
                className="mt-2"
                required
              />
              {state.fieldErrors?.hireDate && (
                <p className="mt-1 text-xs text-destructive">
                  {state.fieldErrors.hireDate}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="terminationDate" className="text-sm font-medium">
                Termination date
              </label>
              <Input
                id="terminationDate"
                name="terminationDate"
                type="date"
                defaultValue={employee?.terminationDate ?? ""}
                className="mt-2"
              />
              {state.fieldErrors?.terminationDate && (
                <p className="mt-1 text-xs text-destructive">
                  {state.fieldErrors.terminationDate}
                </p>
              )}
            </div>
          </div>
        </section>

        {!employee && (
          <section>
            <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
              Initial organizational assignment
            </h2>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="departmentId" className="text-sm font-medium">
                  Department
                </label>
                <select
                  id="departmentId"
                  name="departmentId"
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                  className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">Unassigned</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="positionId" className="text-sm font-medium">
                  Position
                </label>
                <select
                  key={departmentId}
                  id="positionId"
                  name="positionId"
                  defaultValue=""
                  disabled={!departmentId}
                  className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm disabled:opacity-50"
                >
                  <option value="">Unassigned</option>
                  {positions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        )}

        <footer className="flex justify-end border-t border-border pt-5">
          <Button type="submit" disabled={pending}>
            <Save />
            {pending
              ? "Saving…"
              : employee
                ? "Save employee"
                : "Create employee"}
          </Button>
        </footer>
      </PageShell>
    </form>
  );
}
