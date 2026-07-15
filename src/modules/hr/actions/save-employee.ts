"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import {
  EmploymentStatus,
  EmploymentType,
} from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"

export type EmployeeFormState = {
  status: "idle" | "error" | "conflict"
  message: string
  fieldErrors?: Record<string, string>
}

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function nullableText(
  formData: FormData,
  key: string,
): string | null {
  const value = textValue(formData, key)
  return value.length > 0 ? value : null
}

function parseDate(value: string): Date | null {
  if (!value) {
    return null
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

async function requestMetadata() {
  const requestHeaders = await headers()

  return {
    ipAddress:
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      requestHeaders.get("x-real-ip") ??
      null,
    userAgent: requestHeaders.get("user-agent"),
  }
}

function validateEmployee(formData: FormData) {
  const firstName = textValue(formData, "firstName")
  const lastName = textValue(formData, "lastName")
  const employmentTypeValue = textValue(
    formData,
    "employmentType",
  )
  const employmentStatusValue = textValue(
    formData,
    "employmentStatus",
  )
  const hireDate = parseDate(textValue(formData, "hireDate"))
  const terminationDate = parseDate(
    textValue(formData, "terminationDate"),
  )
  const workEmail = nullableText(formData, "workEmail")
  const personalEmail = nullableText(formData, "personalEmail")

  const fieldErrors: Record<string, string> = {}

  if (firstName.length < 2) {
    fieldErrors.firstName =
      "First name must contain at least two characters."
  }

  if (lastName.length < 2) {
    fieldErrors.lastName =
      "Last name must contain at least two characters."
  }

  if (
    !Object.values(EmploymentType).includes(
      employmentTypeValue as EmploymentType,
    )
  ) {
    fieldErrors.employmentType =
      "Select a valid employment type."
  }

  if (
    !Object.values(EmploymentStatus).includes(
      employmentStatusValue as EmploymentStatus,
    )
  ) {
    fieldErrors.employmentStatus =
      "Select a valid employment status."
  }

  if (!hireDate) {
    fieldErrors.hireDate = "Enter a valid hire date."
  }

  if (
    terminationDate &&
    hireDate &&
    terminationDate < hireDate
  ) {
    fieldErrors.terminationDate =
      "Termination date cannot be before the hire date."
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (workEmail && !emailPattern.test(workEmail)) {
    fieldErrors.workEmail = "Enter a valid work email address."
  }

  if (personalEmail && !emailPattern.test(personalEmail)) {
    fieldErrors.personalEmail =
      "Enter a valid personal email address."
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    values: {
      firstName,
      middleName: nullableText(formData, "middleName"),
      lastName,
      preferredName: nullableText(formData, "preferredName"),
      workEmail,
      personalEmail,
      phone: nullableText(formData, "phone"),
      employmentType:
        employmentTypeValue as EmploymentType,
      employmentStatus:
        employmentStatusValue as EmploymentStatus,
      hireDate,
      terminationDate,
      departmentId: nullableText(formData, "departmentId"),
      positionId: nullableText(formData, "positionId"),
    },
  }
}

async function validateStructureSelection(
  organizationId: string,
  departmentId: string | null,
  positionId: string | null,
): Promise<string | null> {
  if (positionId && !departmentId) {
    return "A department must be selected for the position."
  }

  if (!departmentId) {
    return null
  }

  const department = await prisma.department.findFirst({
    where: {
      id: departmentId,
      organizationId,
      isActive: true,
    },
    select: {
      id: true,
    },
  })

  if (!department) {
    return "The selected department is invalid or inactive."
  }

  if (positionId) {
    const position = await prisma.position.findFirst({
      where: {
        id: positionId,
        departmentId,
        isActive: true,
      },
      select: {
        id: true,
      },
    })

    if (!position) {
      return "The selected position does not belong to the department."
    }
  }

  return null
}

export async function createEmployee(
  _previousState: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const validation = validateEmployee(formData)

  if (!validation.valid) {
    return {
      status: "error",
      message: "Review the highlighted employee information.",
      fieldErrors: validation.fieldErrors,
    }
  }

  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  })

  if (!organization) {
    return {
      status: "error",
      message: "No organization is configured.",
    }
  }

  const structureError = await validateStructureSelection(
    organization.id,
    validation.values.departmentId,
    validation.values.positionId,
  )

  if (structureError) {
    return {
      status: "error",
      message: structureError,
    }
  }

  try {
    const metadata = await requestMetadata()

    const administrator = await prisma.user.findUnique({
      where: {
        email: "admin@q-nxus.local",
      },
      select: {
        id: true,
      },
    })

    const employee = await prisma.$transaction(
      async (transaction) => {
        const sequence =
          await transaction.numberingSequence.findFirst({
            where: {
              organizationId: organization.id,
              sequenceCode: "EMPLOYEE",
              isActive: true,
            },
          })

        if (!sequence) {
          throw new Error(
            "The EMPLOYEE numbering sequence is not configured.",
          )
        }

        const updatedSequence =
          await transaction.numberingSequence.update({
            where: {
              id: sequence.id,
            },
            data: {
              currentNumber: {
                increment: 1,
              },
              version: {
                increment: 1,
              },
            },
          })

        const numberPart =
          updatedSequence.currentNumber
            .toString()
            .padStart(updatedSequence.minimumLength, "0")

        const employeeNumber = `${updatedSequence.prefix ?? ""}${numberPart}${updatedSequence.suffix ?? ""}`

        const created = await transaction.employee.create({
          data: {
            organizationId: organization.id,
            employeeNumber,
            firstName: validation.values.firstName,
            middleName: validation.values.middleName,
            lastName: validation.values.lastName,
            preferredName: validation.values.preferredName,
            workEmail: validation.values.workEmail,
            personalEmail: validation.values.personalEmail,
            phone: validation.values.phone,
            employmentStatus:
              validation.values.employmentStatus,
            employmentType:
              validation.values.employmentType,
            hireDate: validation.values.hireDate!,
            terminationDate:
              validation.values.terminationDate,
            departmentId: validation.values.departmentId,
            positionId: validation.values.positionId,
          },
        })

        await transaction.auditEvent.create({
          data: {
            userId: administrator?.id ?? null,
            moduleKey: "hr",
            action: "CREATE",
            entityType: "Employee",
            entityId: created.id,
            description: `Created employee ${created.employeeNumber} — ${created.firstName} ${created.lastName}.`,
            newValues: {
              employeeNumber: created.employeeNumber,
              firstName: created.firstName,
              middleName: created.middleName,
              lastName: created.lastName,
              preferredName: created.preferredName,
              workEmail: created.workEmail,
              personalEmail: created.personalEmail,
              phone: created.phone,
              employmentStatus: created.employmentStatus,
              employmentType: created.employmentType,
              hireDate: created.hireDate,
              terminationDate: created.terminationDate,
              departmentId: created.departmentId,
              positionId: created.positionId,
            },
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
          },
        })

        return created
      },
    )

    revalidatePath("/people")
    redirect(`/people/employees/${employee.id}`)
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === "NEXT_REDIRECT"
    ) {
      throw error
    }

    console.error("Unable to create employee:", error)

    return {
      status: "error",
      message:
        error instanceof Error &&
        error.message.includes("EMPLOYEE numbering sequence")
          ? error.message
          : "The employee record could not be created.",
    }
  }
}

export async function updateEmployee(
  _previousState: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const id = textValue(formData, "id")
  const submittedUpdatedAt = textValue(
    formData,
    "updatedAt",
  )
  const validation = validateEmployee(formData)

  if (!id || !submittedUpdatedAt) {
    return {
      status: "error",
      message: "The employee record is incomplete.",
    }
  }

  if (!validation.valid) {
    return {
      status: "error",
      message: "Review the highlighted employee information.",
      fieldErrors: validation.fieldErrors,
    }
  }

  const current = await prisma.employee.findUnique({
    where: {
      id,
    },
  })

  if (!current) {
    return {
      status: "error",
      message: "The employee record no longer exists.",
    }
  }

  if (current.updatedAt.toISOString() !== submittedUpdatedAt) {
    return {
      status: "conflict",
      message:
        "This employee was updated elsewhere. Refresh before saving.",
    }
  }

  const structureError = await validateStructureSelection(
    current.organizationId,
    validation.values.departmentId,
    validation.values.positionId,
  )

  if (structureError) {
    return {
      status: "error",
      message: structureError,
    }
  }

  try {
    const metadata = await requestMetadata()

    const administrator = await prisma.user.findUnique({
      where: {
        email: "admin@q-nxus.local",
      },
      select: {
        id: true,
      },
    })

    const result = await prisma.$transaction(
      async (transaction) => {
        const updateResult =
          await transaction.employee.updateMany({
            where: {
              id,
              updatedAt: current.updatedAt,
            },
            data: {
              firstName: validation.values.firstName,
              middleName: validation.values.middleName,
              lastName: validation.values.lastName,
              preferredName:
                validation.values.preferredName,
              workEmail: validation.values.workEmail,
              personalEmail:
                validation.values.personalEmail,
              phone: validation.values.phone,
              employmentStatus:
                validation.values.employmentStatus,
              employmentType:
                validation.values.employmentType,
              hireDate: validation.values.hireDate!,
              terminationDate:
                validation.values.terminationDate,
              departmentId:
                validation.values.departmentId,
              positionId: validation.values.positionId,
            },
          })

        if (updateResult.count !== 1) {
          return false
        }

        const updated =
          await transaction.employee.findUniqueOrThrow({
            where: {
              id,
            },
          })

        await transaction.auditEvent.create({
          data: {
            userId: administrator?.id ?? null,
            moduleKey: "hr",
            action: "UPDATE",
            entityType: "Employee",
            entityId: updated.id,
            description: `Updated employee ${updated.employeeNumber} — ${updated.firstName} ${updated.lastName}.`,
            oldValues: {
              firstName: current.firstName,
              middleName: current.middleName,
              lastName: current.lastName,
              preferredName: current.preferredName,
              workEmail: current.workEmail,
              personalEmail: current.personalEmail,
              phone: current.phone,
              employmentStatus:
                current.employmentStatus,
              employmentType: current.employmentType,
              hireDate: current.hireDate,
              terminationDate: current.terminationDate,
              departmentId: current.departmentId,
              positionId: current.positionId,
            },
            newValues: {
              firstName: updated.firstName,
              middleName: updated.middleName,
              lastName: updated.lastName,
              preferredName: updated.preferredName,
              workEmail: updated.workEmail,
              personalEmail: updated.personalEmail,
              phone: updated.phone,
              employmentStatus:
                updated.employmentStatus,
              employmentType: updated.employmentType,
              hireDate: updated.hireDate,
              terminationDate:
                updated.terminationDate,
              departmentId: updated.departmentId,
              positionId: updated.positionId,
            },
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
          },
        })

        return true
      },
    )

    if (!result) {
      return {
        status: "conflict",
        message:
          "This employee changed while being saved. Refresh the page.",
      }
    }

    revalidatePath("/people")
    revalidatePath(`/people/employees/${id}`)
    redirect(`/people/employees/${id}`)
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === "NEXT_REDIRECT"
    ) {
      throw error
    }

    console.error("Unable to update employee:", error)

    return {
      status: "error",
      message: "The employee record could not be updated.",
    }
  }
}
