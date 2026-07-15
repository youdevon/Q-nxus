"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  Save,
} from "lucide-react"
import { toast } from "sonner"

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
import type {
  DepartmentProfileRecord,
  DepartmentRecord,
  PositionProfileRecord,
} from "@/src/modules/hr/data/get-people-structure"
import { PeopleNav } from "./people-nav"

const initialState: StructureFormState = {
  status: "idle",
  message: "",
}

function useStructureMessage(state: StructureFormState) {
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
}

export function DepartmentRecordForm({
  department,
}: {
  department?: DepartmentProfileRecord | null
}) {
  const action = department
    ? updateDepartment
    : createDepartment

  const [state, formAction, pending] = useActionState(
    action,
    initialState,
  )

  useStructureMessage(state)

  return (
    <form
      action={formAction}
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8"
    >
      <PeopleNav />

      <PageHeader
        title={
          department ? "Edit department" : "New department"
        }
        description="Configure the department identity and status."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              render={
                <Link
                  href={
                    department
                      ? `/people/structure/departments/${department.id}`
                      : "/people/structure"
                  }
                />
              }
            >
              <ArrowLeft />
              Cancel
            </Button>

            <Button type="submit" disabled={pending}>
              <Save />
              {pending ? "Saving…" : "Save department"}
            </Button>
          </div>
        }
      />

      {department && (
        <>
          <input
            type="hidden"
            name="id"
            value={department.id}
          />
          <input
            type="hidden"
            name="updatedAt"
            value={department.updatedAt}
          />
        </>
      )}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Department details
          </h2>
        </div>

        <div className="grid gap-5 border-y border-border py-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="name"
              className="text-sm font-medium"
            >
              Department name
            </label>
            <Input
              id="name"
              name="name"
              defaultValue={department?.name ?? ""}
              className="mt-2"
              required
            />
          </div>

          <div>
            <label
              htmlFor="code"
              className="text-sm font-medium"
            >
              Code
            </label>
            <Input
              id="code"
              name="code"
              defaultValue={department?.code ?? ""}
              className="mt-2 font-mono"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="description"
              className="text-sm font-medium"
            >
              Description
            </label>
            <Textarea
              id="description"
              name="description"
              defaultValue={department?.description ?? ""}
              rows={4}
              className="mt-2"
            />
          </div>

          {department && (
            <label className="flex items-center gap-3 md:col-span-2">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={department.isActive}
                className="size-4"
              />
              <span className="text-sm font-medium">
                Department is active
              </span>
            </label>
          )}
        </div>
      </section>
    </form>
  )
}

export function PositionRecordForm({
  position,
  departments,
}: {
  position?: PositionProfileRecord | null
  departments: DepartmentRecord[]
}) {
  const action = position ? updatePosition : createPosition

  const [state, formAction, pending] = useActionState(
    action,
    initialState,
  )

  useStructureMessage(state)

  return (
    <form
      action={formAction}
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8"
    >
      <PeopleNav />

      <PageHeader
        title={position ? "Edit position" : "New position"}
        description="Configure the position identity and department."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              render={
                <Link
                  href={
                    position
                      ? `/people/structure/positions/${position.id}`
                      : "/people/structure"
                  }
                />
              }
            >
              <ArrowLeft />
              Cancel
            </Button>

            <Button type="submit" disabled={pending}>
              <Save />
              {pending ? "Saving…" : "Save position"}
            </Button>
          </div>
        }
      />

      {position && (
        <>
          <input
            type="hidden"
            name="id"
            value={position.id}
          />
          <input
            type="hidden"
            name="updatedAt"
            value={position.updatedAt}
          />
        </>
      )}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <BriefcaseBusiness className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Position details
          </h2>
        </div>

        <div className="grid gap-5 border-y border-border py-6 md:grid-cols-2">
          {!position && (
            <div>
              <label
                htmlFor="departmentId"
                className="text-sm font-medium"
              >
                Department
              </label>
              <select
                id="departmentId"
                name="departmentId"
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                required
              >
                <option value="">
                  Select department
                </option>
                {departments
                  .filter(
                    (department) => department.isActive,
                  )
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
          )}

          {position && (
            <div>
              <p className="text-sm font-medium">
                Department
              </p>
              <p className="mt-2 text-sm">
                {position.department.name}
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="title"
              className="text-sm font-medium"
            >
              Position title
            </label>
            <Input
              id="title"
              name="title"
              defaultValue={position?.title ?? ""}
              className="mt-2"
              required
            />
          </div>

          <div>
            <label
              htmlFor="code"
              className="text-sm font-medium"
            >
              Code
            </label>
            <Input
              id="code"
              name="code"
              defaultValue={position?.code ?? ""}
              className="mt-2 font-mono"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="description"
              className="text-sm font-medium"
            >
              Description
            </label>
            <Textarea
              id="description"
              name="description"
              defaultValue={position?.description ?? ""}
              rows={4}
              className="mt-2"
            />
          </div>

          {position && (
            <label className="flex items-center gap-3 md:col-span-2">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={position.isActive}
                className="size-4"
              />
              <span className="text-sm font-medium">
                Position is active
              </span>
            </label>
          )}
        </div>
      </section>
    </form>
  )
}
