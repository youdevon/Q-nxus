"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  EmploymentContractStatus,
  EmploymentStatus,
} from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities"

export type CloseContractFormState = {
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

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
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

export async function closeEmploymentContract(
  _previousState: CloseContractFormState,
  formData: FormData,
): Promise<CloseContractFormState> {
  const actor = await requireActor("contracts.manage")

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    }
  }

  const employeeId = textValue(formData, "employeeId")
  const contractId = textValue(formData, "contractId")
  const submittedUpdatedAt = textValue(
    formData,
    "updatedAt",
  )
  const closureStatusValue = textValue(
    formData,
    "closureStatus",
  )
  const effectiveDate = parseDate(
    textValue(formData, "effectiveDate"),
  )
  const terminationReason = nullableText(
    formData,
    "terminationReason",
  )
  const documentReference = nullableText(
    formData,
    "documentReference",
  )
  const updateEmployeeStatus =
    formData.get("updateEmployeeStatus") === "on"
  const employeeStatusValue = textValue(
    formData,
    "employeeStatus",
  )
  const confirmed =
    formData.get("confirmed") === "on"

  const permittedStatuses = new Set<
    EmploymentContractStatus
  >([
    EmploymentContractStatus.EXPIRED,
    EmploymentContractStatus.TERMINATED,
    EmploymentContractStatus.CANCELLED,
  ])

  const fieldErrors: Record<string, string> = {}

  if (
    !permittedStatuses.has(
      closureStatusValue as EmploymentContractStatus,
    )
  ) {
    fieldErrors.closureStatus =
      "Select a valid closure type."
  }

  if (!effectiveDate) {
    fieldErrors.effectiveDate =
      "Enter a valid effective date."
  }

  if (
    closureStatusValue === "TERMINATED" &&
    !terminationReason
  ) {
    fieldErrors.terminationReason =
      "Enter the reason for terminating the contract."
  }

  if (!confirmed) {
    fieldErrors.confirmed =
      "Confirm that the contract should be closed."
  }

  if (
    updateEmployeeStatus &&
    !Object.values(EmploymentStatus).includes(
      employeeStatusValue as EmploymentStatus,
    )
  ) {
    fieldErrors.employeeStatus =
      "Select a valid employee status."
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the contract closure information.",
      fieldErrors,
    }
  }

  const contract = await prisma.employmentContract.findFirst({
    where: {
      id: contractId,
      employeeId,
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          employmentStatus: true,
        },
      },
    },
  })

  if (!contract) {
    return {
      status: "error",
      message: "The employment contract no longer exists.",
    }
  }

  if (!contract.isCurrent) {
    return {
      status: "error",
      message: "Only the current contract can be closed.",
    }
  }

  if (
    !submittedUpdatedAt ||
    contract.updatedAt.toISOString() !== submittedUpdatedAt
  ) {
    return {
      status: "conflict",
      message:
        "The contract changed elsewhere. Refresh before continuing.",
    }
  }

  if (effectiveDate! < contract.startDate) {
    return {
      status: "error",
      message:
        "The closure date cannot be before the contract start date.",
    }
  }

  const metadata = await requestMetadata()

  try {
    await prisma.$transaction(async (transaction) => {
      const result =
        await transaction.employmentContract.updateMany({
          where: {
            id: contractId,
            employeeId,
            isCurrent: true,
            updatedAt: contract.updatedAt,
          },
          data: {
            status:
              closureStatusValue as EmploymentContractStatus,
            isCurrent: false,
            endDate:
              closureStatusValue === "EXPIRED"
                ? effectiveDate
                : contract.endDate ?? effectiveDate,
            terminationDate:
              closureStatusValue === "TERMINATED"
                ? effectiveDate
                : null,
            terminationReason:
              closureStatusValue === "TERMINATED"
                ? terminationReason
                : null,
            documentReference:
              documentReference ??
              contract.documentReference,
          },
        })

      if (result.count !== 1) {
        throw new Error("CONTRACT_CONFLICT")
      }

      if (updateEmployeeStatus) {
        await transaction.employee.update({
          where: {
            id: employeeId,
          },
          data: {
            employmentStatus:
              employeeStatusValue as EmploymentStatus,
            terminationDate:
              employeeStatusValue ===
                EmploymentStatus.TERMINATED ||
              employeeStatusValue ===
                EmploymentStatus.RETIRED
                ? effectiveDate
                : undefined,
          },
        })
      }

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
          moduleKey: "hr",
          action: "CLOSE",
          entityType: "EmploymentContract",
          entityId: contractId,
          description: `Closed employment contract for ${contract.employee.employeeNumber} — ${contract.employee.firstName} ${contract.employee.lastName}.`,
          oldValues: {
            status: contract.status,
            isCurrent: contract.isCurrent,
            endDate: contract.endDate,
            employmentStatus:
              contract.employee.employmentStatus,
          },
          newValues: {
            status: closureStatusValue,
            isCurrent: false,
            effectiveDate,
            terminationReason,
            documentReference,
            employeeStatus: updateEmployeeStatus
              ? employeeStatusValue
              : contract.employee.employmentStatus,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      })
    })

    revalidatePath("/contracts")
    revalidatePath("/people")
    revalidatePath(`/people/employees/${employeeId}`)
    revalidatePath(
      `/people/employees/${employeeId}/contracts`,
    )
    revalidatePath(
      `/people/employees/${employeeId}/contracts/${contractId}`,
    )

    redirect(
      `/people/employees/${employeeId}/contracts/${contractId}`,
    )
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === "NEXT_REDIRECT"
    ) {
      throw error
    }

    if (
      error instanceof Error &&
      error.message === "CONTRACT_CONFLICT"
    ) {
      return {
        status: "conflict",
        message:
          "The contract changed while being closed. Refresh and try again.",
      }
    }

    console.error("Unable to close contract:", error)

    return {
      status: "error",
      message: "The employment contract could not be closed.",
    }
  }
}
