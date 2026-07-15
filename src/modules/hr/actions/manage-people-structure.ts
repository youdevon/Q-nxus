"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"

export type StructureFormState = {
  status: "idle" | "success" | "error" | "conflict"
  message: string
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

async function getAdministratorId(): Promise<string | null> {
  const administrator = await prisma.user.findUnique({
    where: {
      email: "admin@q-nxus.local",
    },
    select: {
      id: true,
    },
  })

  return administrator?.id ?? null
}

export async function createDepartment(
  _previousState: StructureFormState,
  formData: FormData,
): Promise<StructureFormState> {
  const name = textValue(formData, "name")
  const code = nullableText(formData, "code")
  const description = nullableText(formData, "description")

  if (name.length < 2) {
    return {
      status: "error",
      message: "Department name must contain at least two characters.",
    }
  }

  try {
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

    const duplicate = await prisma.department.findFirst({
      where: {
        organizationId: organization.id,
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    })

    if (duplicate) {
      return {
        status: "error",
        message: "A department with this name already exists.",
      }
    }

    const metadata = await requestMetadata()
    const administratorId = await getAdministratorId()

    await prisma.$transaction(async (transaction) => {
      const department = await transaction.department.create({
        data: {
          organizationId: organization.id,
          name,
          code,
          description,
          isActive: true,
        },
      })

      await transaction.auditEvent.create({
        data: {
          userId: administratorId,
          moduleKey: "hr",
          action: "CREATE",
          entityType: "Department",
          entityId: department.id,
          description: `Created department ${department.name}.`,
          newValues: {
            name: department.name,
            code: department.code,
            description: department.description,
            isActive: department.isActive,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      })
    })

    revalidatePath("/people/structure")

    return {
      status: "success",
      message: "Department created successfully.",
    }
  } catch (error: unknown) {
    console.error("Unable to create department:", error)

    return {
      status: "error",
      message: "The department could not be created.",
    }
  }
}

export async function updateDepartment(
  _previousState: StructureFormState,
  formData: FormData,
): Promise<StructureFormState> {
  const id = textValue(formData, "id")
  const submittedUpdatedAt = textValue(formData, "updatedAt")
  const name = textValue(formData, "name")
  const code = nullableText(formData, "code")
  const description = nullableText(formData, "description")
  const isActive = formData.get("isActive") === "on"

  if (!id || !submittedUpdatedAt || name.length < 2) {
    return {
      status: "error",
      message: "The department information is incomplete.",
    }
  }

  try {
    const current = await prisma.department.findUnique({
      where: {
        id,
      },
    })

    if (!current) {
      return {
        status: "error",
        message: "The department no longer exists.",
      }
    }

    if (current.updatedAt.toISOString() !== submittedUpdatedAt) {
      return {
        status: "conflict",
        message:
          "This department was updated elsewhere. Refresh the page before saving.",
      }
    }

    const duplicate = await prisma.department.findFirst({
      where: {
        organizationId: current.organizationId,
        id: {
          not: id,
        },
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    })

    if (duplicate) {
      return {
        status: "error",
        message: "A department with this name already exists.",
      }
    }

    const metadata = await requestMetadata()
    const administratorId = await getAdministratorId()

    const result = await prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.department.updateMany({
        where: {
          id,
          updatedAt: current.updatedAt,
        },
        data: {
          name,
          code,
          description,
          isActive,
        },
      })

      if (updateResult.count !== 1) {
        return false
      }

      const updated = await transaction.department.findUniqueOrThrow({
        where: {
          id,
        },
      })

      await transaction.auditEvent.create({
        data: {
          userId: administratorId,
          moduleKey: "hr",
          action: "UPDATE",
          entityType: "Department",
          entityId: updated.id,
          description: `Updated department ${updated.name}.`,
          oldValues: {
            name: current.name,
            code: current.code,
            description: current.description,
            isActive: current.isActive,
          },
          newValues: {
            name: updated.name,
            code: updated.code,
            description: updated.description,
            isActive: updated.isActive,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      })

      return true
    })

    if (!result) {
      return {
        status: "conflict",
        message:
          "This department changed while it was being saved. Refresh the page.",
      }
    }

    revalidatePath("/people/structure")

    return {
      status: "success",
      message: "Department updated successfully.",
    }
  } catch (error: unknown) {
    console.error("Unable to update department:", error)

    return {
      status: "error",
      message: "The department could not be updated.",
    }
  }
}

export async function createPosition(
  _previousState: StructureFormState,
  formData: FormData,
): Promise<StructureFormState> {
  const departmentId = textValue(formData, "departmentId")
  const title = textValue(formData, "title")
  const code = nullableText(formData, "code")
  const description = nullableText(formData, "description")

  if (!departmentId || title.length < 2) {
    return {
      status: "error",
      message: "Select a department and enter a valid position title.",
    }
  }

  try {
    const department = await prisma.department.findUnique({
      where: {
        id: departmentId,
      },
      select: {
        id: true,
        name: true,
      },
    })

    if (!department) {
      return {
        status: "error",
        message: "The selected department no longer exists.",
      }
    }

    const duplicate = await prisma.position.findFirst({
      where: {
        departmentId,
        title: {
          equals: title,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    })

    if (duplicate) {
      return {
        status: "error",
        message:
          "A position with this title already exists in the department.",
      }
    }

    const metadata = await requestMetadata()
    const administratorId = await getAdministratorId()

    await prisma.$transaction(async (transaction) => {
      const position = await transaction.position.create({
        data: {
          departmentId,
          title,
          code,
          description,
          isActive: true,
        },
      })

      await transaction.auditEvent.create({
        data: {
          userId: administratorId,
          moduleKey: "hr",
          action: "CREATE",
          entityType: "Position",
          entityId: position.id,
          description: `Created position ${position.title} in ${department.name}.`,
          newValues: {
            departmentId,
            title: position.title,
            code: position.code,
            description: position.description,
            isActive: position.isActive,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      })
    })

    revalidatePath("/people/structure")

    return {
      status: "success",
      message: "Position created successfully.",
    }
  } catch (error: unknown) {
    console.error("Unable to create position:", error)

    return {
      status: "error",
      message: "The position could not be created.",
    }
  }
}

export async function updatePosition(
  _previousState: StructureFormState,
  formData: FormData,
): Promise<StructureFormState> {
  const id = textValue(formData, "id")
  const submittedUpdatedAt = textValue(formData, "updatedAt")
  const title = textValue(formData, "title")
  const code = nullableText(formData, "code")
  const description = nullableText(formData, "description")
  const isActive = formData.get("isActive") === "on"

  if (!id || !submittedUpdatedAt || title.length < 2) {
    return {
      status: "error",
      message: "The position information is incomplete.",
    }
  }

  try {
    const current = await prisma.position.findUnique({
      where: {
        id,
      },
      include: {
        department: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!current) {
      return {
        status: "error",
        message: "The position no longer exists.",
      }
    }

    if (current.updatedAt.toISOString() !== submittedUpdatedAt) {
      return {
        status: "conflict",
        message:
          "This position was updated elsewhere. Refresh the page before saving.",
      }
    }

    const duplicate = await prisma.position.findFirst({
      where: {
        departmentId: current.departmentId,
        id: {
          not: id,
        },
        title: {
          equals: title,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    })

    if (duplicate) {
      return {
        status: "error",
        message:
          "A position with this title already exists in the department.",
      }
    }

    const metadata = await requestMetadata()
    const administratorId = await getAdministratorId()

    const result = await prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.position.updateMany({
        where: {
          id,
          updatedAt: current.updatedAt,
        },
        data: {
          title,
          code,
          description,
          isActive,
        },
      })

      if (updateResult.count !== 1) {
        return false
      }

      const updated = await transaction.position.findUniqueOrThrow({
        where: {
          id,
        },
      })

      await transaction.auditEvent.create({
        data: {
          userId: administratorId,
          moduleKey: "hr",
          action: "UPDATE",
          entityType: "Position",
          entityId: updated.id,
          description: `Updated position ${updated.title}.`,
          oldValues: {
            title: current.title,
            code: current.code,
            description: current.description,
            isActive: current.isActive,
          },
          newValues: {
            title: updated.title,
            code: updated.code,
            description: updated.description,
            isActive: updated.isActive,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      })

      return true
    })

    if (!result) {
      return {
        status: "conflict",
        message:
          "This position changed while it was being saved. Refresh the page.",
      }
    }

    revalidatePath("/people/structure")

    return {
      status: "success",
      message: "Position updated successfully.",
    }
  } catch (error: unknown) {
    console.error("Unable to update position:", error)

    return {
      status: "error",
      message: "The position could not be updated.",
    }
  }
}
