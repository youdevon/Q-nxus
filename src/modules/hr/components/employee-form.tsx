"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Save, UserRound, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageShell } from "@/src/components/layout/page-shell";
import { cn } from "@/lib/utils";
import { ageFromDateOfBirth } from "@/src/lib/age";
import {
  createEmployee,
  updateEmployee,
  type EmployeeFormState,
} from "@/src/modules/hr/actions/save-employee";
import type {
  EmployeeFormDepartment,
  EmployeeFormRecord,
} from "@/src/modules/hr/data/get-employee-form-data";
import {
  BOARD_MEMBER_UI,
  isFullEmployee,
  WorkforceCategory,
  WORKFORCE_CATEGORY_OPTIONS,
} from "@/src/modules/hr/lib/workforce-category";

type EmployeeFormProps = {
  employee?: EmployeeFormRecord;
  departments: EmployeeFormDepartment[];
  /** Prefill workforce category on create (e.g. BOARD from ?category=). */
  initialWorkforceCategory?: string;
};

const initialState: EmployeeFormState = {
  status: "idle",
  message: "",
};

function resolveInitialCategory(
  employee: EmployeeFormRecord | undefined,
  initialWorkforceCategory: string | undefined,
): string {
  if (employee?.workforceCategory) {
    return employee.workforceCategory;
  }
  const match = WORKFORCE_CATEGORY_OPTIONS.find(
    (option) => option.value === initialWorkforceCategory,
  );
  return match?.value ?? WorkforceCategory.EMPLOYEE;
}

export function EmployeeForm({
  employee,
  departments,
  initialWorkforceCategory,
}: EmployeeFormProps) {
  const action = employee ? updateEmployee : createEmployee;
  const [state, formAction, pending] = useActionState(action, initialState);

  const [departmentId, setDepartmentId] = useState(
    employee?.departmentId ?? "",
  );
  const [dateOfBirth, setDateOfBirth] = useState(
    employee?.dateOfBirth ?? "",
  );
  const [workforceCategory, setWorkforceCategory] = useState(
    resolveInitialCategory(employee, initialWorkforceCategory),
  );
  const showOrgAssignment = isFullEmployee(workforceCategory);
  const boardMode = workforceCategory === WorkforceCategory.BOARD;
  /** Existing board payees keep category locked; create flow always allows switching. */
  const lockBoardCategory =
    employee?.workforceCategory === WorkforceCategory.BOARD;

  const positions = useMemo(
    () =>
      departments.find((department) => department.id === departmentId)
        ?.positions ?? [],
    [departmentId, departments],
  );
  const dateOfBirthAge = useMemo(
    () => ageFromDateOfBirth(dateOfBirth),
    [dateOfBirth],
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
        <PeoplePageHeader
          title={
            employee
              ? `${employee.firstName} ${employee.lastName}`
              : "New person"
          }
          description={
            employee
              ? boardMode
                ? "Manage board payee and contact details."
                : `Manage ${employee.employeeNumber}.`
              : "Create an employee or payee (agent, board, contractor). Choose the workforce category below. Personal email becomes their login for self-service."
          }
          icon={boardMode ? Users : undefined}
          titleAccentClassName={boardMode ? BOARD_MEMBER_UI.headerBand : undefined}
          badge={
            boardMode && !employee ? (
              <Badge variant="outline" className={BOARD_MEMBER_UI.badge}>
                Board member
              </Badge>
            ) : undefined
          }
          backHref={employee ? `/people/employees/${employee.id}` : "/people"}
          backLabel={employee ? "Profile" : "People"}
          actions={
            <FormPageActions
              cancelHref={
                employee ? `/people/employees/${employee.id}` : "/people"
              }
            >
              {employee && showOrgAssignment ? (
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
              ) : null}
              <Button
                type="submit"
                disabled={pending}
                className={boardMode ? BOARD_MEMBER_UI.button : undefined}
              >
                <Save />
                {pending ? "Saving…" : employee ? "Save" : "Create"}
              </Button>
            </FormPageActions>
          }
        />

        {employee && (
          <>
            <input type="hidden" name="id" value={employee.id} />
            <input type="hidden" name="updatedAt" value={employee.updatedAt} />

            <div className="flex flex-wrap items-center gap-2">
              <UserRound className="size-4 text-muted-foreground" />
              {boardMode ? (
                <Badge variant="outline" className={BOARD_MEMBER_UI.badge}>
                  Board member
                </Badge>
              ) : (
                <>
                  <span className="font-mono text-sm font-medium">
                    {employee.employeeNumber}
                  </span>
                  <Badge variant="outline">
                    {employee.employmentStatus
                      .replaceAll("_", " ")
                      .toLowerCase()}
                  </Badge>
                </>
              )}
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
              <label
                htmlFor="dateOfBirth"
                className="flex items-baseline gap-1 text-sm font-medium"
              >
                <span>Date of birth</span>
                {dateOfBirthAge === null ? null : (
                  <span className="text-muted-foreground">
                    ({dateOfBirthAge})
                  </span>
                )}
              </label>
              <Input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
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

            <div className="md:col-span-2">
              <label htmlFor="address" className="text-sm font-medium">
                Address
              </label>
              <Textarea
                id="address"
                name="address"
                rows={3}
                defaultValue={employee?.address ?? ""}
                className="mt-2"
                autoComplete="street-address"
              />
            </div>

            {!boardMode ? (
              <>
                <div>
                  <label
                    htmlFor="emergencyContactName"
                    className="text-sm font-medium"
                  >
                    Emergency contact name
                  </label>
                  <Input
                    id="emergencyContactName"
                    name="emergencyContactName"
                    defaultValue={employee?.emergencyContactName ?? ""}
                    className="mt-2"
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="emergencyContactPhone"
                    className="text-sm font-medium"
                  >
                    Emergency contact phone
                  </label>
                  <Input
                    id="emergencyContactPhone"
                    name="emergencyContactPhone"
                    type="tel"
                    defaultValue={employee?.emergencyContactPhone ?? ""}
                    className="mt-2"
                    autoComplete="tel"
                  />
                </div>

                <div>
                  <label
                    htmlFor="emergencyContactRelationship"
                    className="text-sm font-medium"
                  >
                    Emergency contact relationship
                  </label>
                  <Input
                    id="emergencyContactRelationship"
                    name="emergencyContactRelationship"
                    defaultValue={
                      employee?.emergencyContactRelationship ?? ""
                    }
                    placeholder="e.g. Spouse, Parent"
                    className="mt-2"
                  />
                </div>
              </>
            ) : null}

            <div>
              <label htmlFor="personalEmail" className="text-sm font-medium">
                Personal email
                {!employee && !boardMode ? (
                  <span className="text-destructive"> *</span>
                ) : null}
              </label>
              <Input
                id="personalEmail"
                name="personalEmail"
                type="email"
                defaultValue={employee?.personalEmail ?? ""}
                className="mt-2"
                required={!employee && !boardMode}
                autoComplete="email"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {boardMode
                  ? "Optional. Only needed if this board member should log in for self-service."
                  : "Used as the login email for this person's account. They get self-service access only (profile and payslips); broader roles are assigned later under Administration → Access."}
              </p>
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
            Identity &amp; statutory
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            NIS and BIR are the source of truth. They are auto-filled into
            payroll setup, payslips, and letter templates.
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="nisNumber" className="text-sm font-medium">
                NIS number
              </label>
              <Input
                id="nisNumber"
                name="nisNumber"
                defaultValue={employee?.nisNumber ?? ""}
                placeholder="National insurance number"
                className="mt-2"
              />
            </div>

            <div>
              <label htmlFor="birNumber" className="text-sm font-medium">
                BIR number
              </label>
              <Input
                id="birNumber"
                name="birNumber"
                defaultValue={employee?.birNumber ?? ""}
                placeholder="Board of Inland Revenue file number"
                className="mt-2"
              />
            </div>

            <div>
              <label htmlFor="idType" className="text-sm font-medium">
                ID type
              </label>
              <select
                id="idType"
                name="idType"
                defaultValue={employee?.idType ?? ""}
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Not set</option>
                <option value="NATIONAL_ID">National ID</option>
                <option value="DRIVERS_PERMIT">Driver&apos;s Permit</option>
                <option value="NON_NATIONAL">
                  Non-national ID (passport / foreign ID)
                </option>
              </select>
              {state.fieldErrors?.idType && (
                <p className="mt-1 text-xs text-destructive">
                  {state.fieldErrors.idType}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="idNumber" className="text-sm font-medium">
                ID number
              </label>
              <Input
                id="idNumber"
                name="idNumber"
                defaultValue={employee?.idNumber ?? ""}
                className="mt-2"
              />
              {state.fieldErrors?.idNumber && (
                <p className="mt-1 text-xs text-destructive">
                  {state.fieldErrors.idNumber}
                </p>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">
            {boardMode ? "Board engagement" : "Workforce details"}
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            {lockBoardCategory ? (
              <input
                type="hidden"
                name="workforceCategory"
                value={WorkforceCategory.BOARD}
              />
            ) : (
              <div>
                <label
                  htmlFor="workforceCategory"
                  className="text-sm font-medium"
                >
                  Workforce category
                </label>
                <select
                  id="workforceCategory"
                  name="workforceCategory"
                  value={workforceCategory}
                  onChange={(event) => {
                    setWorkforceCategory(event.target.value);
                    if (!isFullEmployee(event.target.value)) {
                      setDepartmentId("");
                    }
                  }}
                  className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                  required
                >
                  {WORKFORCE_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Agents, board members, and contractors are payees with
                  time-bounded contracts. They do not get an employee file.
                </p>
                {state.fieldErrors?.workforceCategory && (
                  <p className="mt-1 text-xs text-destructive">
                    {state.fieldErrors.workforceCategory}
                  </p>
                )}
              </div>
            )}

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
              <p className="mt-1 text-xs text-muted-foreground">
                Optional contact address. Login uses personal email, not work
                email.
              </p>
              {state.fieldErrors?.workEmail && (
                <p className="mt-1 text-xs text-destructive">
                  {state.fieldErrors.workEmail}
                </p>
              )}
            </div>

            {boardMode ? (
              <>
                <input
                  type="hidden"
                  name="employmentType"
                  value={employee?.employmentType ?? "CONSULTANT"}
                />
                <input
                  type="hidden"
                  name="employmentStatus"
                  value={employee?.employmentStatus ?? "ACTIVE"}
                />
              </>
            ) : (
              <>
                <div>
                  <label
                    htmlFor="employmentType"
                    className="text-sm font-medium"
                  >
                    Employment type
                  </label>
                  <select
                    id="employmentType"
                    name="employmentType"
                    defaultValue={
                      employee?.employmentType ??
                      (showOrgAssignment ? "PERMANENT" : "CONSULTANT")
                    }
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
                  <label
                    htmlFor="employmentStatus"
                    className="text-sm font-medium"
                  >
                    Status
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
              </>
            )}

            <div>
              <label htmlFor="hireDate" className="text-sm font-medium">
                {boardMode
                  ? "Board appointment start"
                  : showOrgAssignment
                    ? "Hire date"
                    : "Engagement start"}
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

            {employee && !boardMode ? (
              <div>
                <label
                  htmlFor="terminationDate"
                  className="text-sm font-medium"
                >
                  Termination date
                </label>
                <Input
                  id="terminationDate"
                  name="terminationDate"
                  type="date"
                  defaultValue={employee.terminationDate ?? ""}
                  className="mt-2"
                />
                {state.fieldErrors?.terminationDate && (
                  <p className="mt-1 text-xs text-destructive">
                    {state.fieldErrors.terminationDate}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Use for leavers. Engagement end dates are set on the contract.
                </p>
              </div>
            ) : null}
          </div>
          {boardMode ? (
            <p className="mt-4 text-xs text-muted-foreground">
              An internal payee reference is generated automatically and kept
              out of this form. Add the board role and appointment end on the
              engagement contract, then complete Payroll setup for fees,
              statutory treatment, and banking.
            </p>
          ) : null}
        </section>

        {!employee && showOrgAssignment ? (
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
        ) : null}
      </PageShell>
    </form>
  );
}
