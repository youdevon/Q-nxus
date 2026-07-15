"use client"

import Link from "next/link"

import {
  useActionState,
  useEffect,
  useState,
} from "react"
import {
  Building2,
  BriefcaseBusiness,
  Plus,
  Save,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/src/components/layout/page-header"
import {
  createDepartment,
  createPosition,
  updateDepartment,
  updatePosition,
  type StructureFormState,
} from "@/src/modules/hr/actions/manage-people-structure"
import type { DepartmentRecord } from "@/src/modules/hr/data/get-people-structure"
import { PeopleNav } from "./people-nav"

type PeopleStructureWorkspaceProps = {
  departments: DepartmentRecord[]
}

const initialState: StructureFormState = {
  status: "idle",
  message: "",
}

function ActionMessage({
  state,
}: {
  state: StructureFormState
}) {
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message)
    }

    if (state.status === "error") {
      toast.error(state.message)
    }

    if (state.status === "conflict") {
      toast.warning(state.message)
    }
  }, [state])

  if (state.status === "idle") {
    return null
  }

  return (
    <p
      className={
        state.status === "success"
          ? "text-xs text-muted-foreground"
          : "text-xs text-destructive"
      }
    >
      {state.message}
    </p>
  )
}

function DepartmentEditor({
  department,
}: {
  department: DepartmentRecord
}) {
  const [state, action, pending] = useActionState(
    updateDepartment,
    initialState,
  )

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={department.id} />
      <input
        type="hidden"
        name="updatedAt"
        value={department.updatedAt}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor={`department-name-${department.id}`}
            className="text-sm font-medium"
          >
            Department name
          </label>
          <Input
            id={`department-name-${department.id}`}
            name="name"
            defaultValue={department.name}
            className="mt-2"
            required
          />
        </div>

        <div>
          <label
            htmlFor={`department-code-${department.id}`}
            className="text-sm font-medium"
          >
            Code
          </label>
          <Input
            id={`department-code-${department.id}`}
            name="code"
            defaultValue={department.code ?? ""}
            className="mt-2 font-mono"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={`department-description-${department.id}`}
          className="text-sm font-medium"
        >
          Description
        </label>
        <Textarea
          id={`department-description-${department.id}`}
          name="description"
          defaultValue={department.description ?? ""}
          rows={3}
          className="mt-2"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={department.isActive}
            className="size-4"
          />
          Active department
        </label>

        <Button type="submit" size="sm" disabled={pending}>
          <Save />
          {pending ? "Saving…" : "Save department"}
        </Button>
      </div>

      <ActionMessage state={state} />
    </form>
  )
}

function PositionEditor({
  position,
}: {
  position: DepartmentRecord["positions"][number]
}) {
  const [state, action, pending] = useActionState(
    updatePosition,
    initialState,
  )

  return (
    <form
      action={action}
      className="grid gap-4 border-t border-border py-4 md:grid-cols-[1fr_10rem_1fr_auto]"
    >
      <input type="hidden" name="id" value={position.id} />
      <input
        type="hidden"
        name="updatedAt"
        value={position.updatedAt}
      />

      <div>
        <label className="text-xs font-medium">
          Position title
        </label>
        <Input
          name="title"
          defaultValue={position.title}
          className="mt-2"
          required
        />
      </div>

      <div>
        <label className="text-xs font-medium">Code</label>
        <Input
          name="code"
          defaultValue={position.code ?? ""}
          className="mt-2 font-mono"
        />
      </div>

      <div>
        <label className="text-xs font-medium">
          Description
        </label>
        <Input
          name="description"
          defaultValue={position.description ?? ""}
          className="mt-2"
        />
      </div>

      <div className="flex flex-col items-start justify-end gap-3">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={position.isActive}
            className="size-4"
          />
          Active
        </label>

        <Button
          type="button"
          variant="outline"
          size="sm"
          render={
            <Link
              href={`/people/structure/positions/${position.id}/job-descriptions`}
            />
          }
        >
          Job description
        </Button>

        <Button type="submit" size="sm" disabled={pending}>
          <Save />
          Save
        </Button>
      </div>

      <div className="md:col-span-4">
        <p className="text-xs text-muted-foreground">
          {position.employeeCount} employee
          {position.employeeCount === 1 ? "" : "s"} assigned
        </p>
        <ActionMessage state={state} />
      </div>
    </form>
  )
}

export function PeopleStructureWorkspace({
  departments,
}: PeopleStructureWorkspaceProps) {
  const [showDepartmentForm, setShowDepartmentForm] =
    useState(false)
  const [showPositionForm, setShowPositionForm] =
    useState(false)

  const [departmentState, departmentAction, departmentPending] =
    useActionState(createDepartment, initialState)

  const [positionState, positionAction, positionPending] =
    useActionState(createPosition, initialState)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <PeopleNav />

      <PageHeader
        title="People Structure"
        description="Manage the departments and positions used across employee records."
        actions={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setShowPositionForm((current) => !current)
              }
              disabled={departments.length === 0}
            >
              <BriefcaseBusiness />
              Add position
            </Button>

            <Button
              type="button"
              onClick={() =>
                setShowDepartmentForm((current) => !current)
              }
            >
              <Plus />
              Add department
            </Button>
          </div>
        }
      />

      <section>
        <div className="grid grid-cols-2 gap-8 border-y border-border py-5 md:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">
              Departments
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {departments.length}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Active departments
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {
                departments.filter(
                  (department) => department.isActive,
                ).length
              }
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Positions
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {departments.reduce(
                (total, department) =>
                  total + department.positions.length,
                0,
              )}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Employees assigned
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {departments.reduce(
                (total, department) =>
                  total + department.employeeCount,
                0,
              )}
            </p>
          </div>
        </div>
      </section>

      {showDepartmentForm && (
        <section className="border-y border-border py-6">
          <div className="mb-5 flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              New department
            </h2>
          </div>

          <form
            action={departmentAction}
            className="grid gap-4 md:grid-cols-2"
          >
            <div>
              <label className="text-sm font-medium">
                Department name
              </label>
              <Input name="name" className="mt-2" required />
            </div>

            <div>
              <label className="text-sm font-medium">Code</label>
              <Input name="code" className="mt-2 font-mono" />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium">
                Description
              </label>
              <Textarea
                name="description"
                rows={3}
                className="mt-2"
              />
            </div>

            <div className="flex items-center justify-between gap-3 md:col-span-2">
              <ActionMessage state={departmentState} />

              <Button
                type="submit"
                disabled={departmentPending}
              >
                <Plus />
                {departmentPending
                  ? "Creating…"
                  : "Create department"}
              </Button>
            </div>
          </form>
        </section>
      )}

      {showPositionForm && departments.length > 0 && (
        <section className="border-y border-border py-6">
          <div className="mb-5 flex items-center gap-2">
            <BriefcaseBusiness className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              New position
            </h2>
          </div>

          <form
            action={positionAction}
            className="grid gap-4 md:grid-cols-2"
          >
            <div>
              <label className="text-sm font-medium">
                Department
              </label>
              <select
                name="departmentId"
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                required
              >
                <option value="">Select department</option>
                {departments
                  .filter((department) => department.isActive)
                  .map((department) => (
                    <option
                      key={department.id}
                      value={department.id}
                    >
                      {department.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">
                Position title
              </label>
              <Input name="title" className="mt-2" required />
            </div>

            <div>
              <label className="text-sm font-medium">Code</label>
              <Input name="code" className="mt-2 font-mono" />
            </div>

            <div>
              <label className="text-sm font-medium">
                Description
              </label>
              <Input name="description" className="mt-2" />
            </div>

            <div className="flex items-center justify-between gap-3 md:col-span-2">
              <ActionMessage state={positionState} />

              <Button
                type="submit"
                disabled={positionPending}
              >
                <Plus />
                {positionPending
                  ? "Creating…"
                  : "Create position"}
              </Button>
            </div>
          </form>
        </section>
      )}

      {departments.length === 0 ? (
        <div className="border-y border-border py-12 text-center">
          <Building2 className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">
            No departments configured
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create the first department before adding positions or
            employees.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {departments.map((department) => (
            <section
              key={department.id}
              className="border-y border-border py-6"
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">
                    {department.name}
                  </h2>

                  {department.code && (
                    <Badge variant="outline">
                      {department.code}
                    </Badge>
                  )}

                  <Badge
                    variant={
                      department.isActive
                        ? "default"
                        : "secondary"
                    }
                  >
                    {department.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <span className="text-xs text-muted-foreground">
                  {department.employeeCount} employee
                  {department.employeeCount === 1 ? "" : "s"} ·{" "}
                  {department.positions.length} position
                  {department.positions.length === 1 ? "" : "s"}
                </span>
              </div>

              <details>
                <summary className="cursor-pointer text-sm font-medium">
                  Edit department
                </summary>

                <div className="mt-5">
                  <DepartmentEditor department={department} />
                </div>
              </details>

              <div className="mt-7">
                <h3 className="mb-2 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                  Positions
                </h3>

                {department.positions.length === 0 ? (
                  <p className="border-t border-border py-5 text-sm text-muted-foreground">
                    No positions have been added to this department.
                  </p>
                ) : (
                  department.positions.map((position) => (
                    <PositionEditor
                      key={position.id}
                      position={position}
                    />
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
