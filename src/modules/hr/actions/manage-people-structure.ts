"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { parsePositionSystemRoleCode } from "@/src/modules/auth/lib/position-system-roles";
import { syncEmployeeAccessRoles } from "@/src/modules/auth/services/provision-employee-user";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";

export type StructureFormState = {
  status: "idle" | "success" | "error" | "conflict";
  message: string;
  entityId?: string;
  createdEntity?: {
    id: string;
    title: string;
    departmentId: string;
  };
  fieldErrors?: {
    name?: string;
    code?: string;
  };
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function findDepartmentNameConflict(input: {
  organizationId: string;
  name: string;
  excludeId?: string;
}): Promise<boolean> {
  const duplicate = await prisma.department.findFirst({
    where: {
      organizationId: input.organizationId,
      ...(input.excludeId
        ? {
            id: {
              not: input.excludeId,
            },
          }
        : {}),
      name: {
        equals: input.name,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(duplicate);
}

async function findDepartmentCodeConflict(input: {
  organizationId: string;
  code: string;
  excludeId?: string;
}): Promise<boolean> {
  const duplicate = await prisma.department.findFirst({
    where: {
      organizationId: input.organizationId,
      ...(input.excludeId
        ? {
            id: {
              not: input.excludeId,
            },
          }
        : {}),
      code: {
        equals: input.code,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(duplicate);
}

export async function createDepartment(
  _previousState: StructureFormState,
  formData: FormData,
): Promise<StructureFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const name = textValue(formData, "name");
  const code = nullableText(formData, "code");
  const description = nullableText(formData, "description");

  if (name.length < 2) {
    return {
      status: "error",
      message: "Department name must contain at least two characters.",
      fieldErrors: {
        name: "Department name must contain at least two characters.",
      },
    };
  }

  try {
    const organization = await prisma.organization.findFirst({
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
      },
    });

    if (!organization) {
      return {
        status: "error",
        message: "No organization is configured.",
      };
    }

    const fieldErrors: NonNullable<StructureFormState["fieldErrors"]> = {};

    if (
      await findDepartmentNameConflict({
        organizationId: organization.id,
        name,
      })
    ) {
      fieldErrors.name = "A department with this name already exists.";
    }

    if (
      code &&
      (await findDepartmentCodeConflict({
        organizationId: organization.id,
        code,
      }))
    ) {
      fieldErrors.code = "A department with this code already exists.";
    }

    if (fieldErrors.name || fieldErrors.code) {
      return {
        status: "error",
        message:
          fieldErrors.name ??
          fieldErrors.code ??
          "A department with these details already exists.",
        fieldErrors,
      };
    }

    const metadata = await getAuditRequestMetadata(formData);

    const departmentId = await prisma.$transaction(async (transaction) => {
      const department = await transaction.department.create({
        data: {
          organizationId: organization.id,
          name,
          code,
          description,
          isActive: true,
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
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
          clientHostName: metadata.clientHostName,
        },
      });

      return department.id;
    });

    revalidatePath("/people/structure");
    revalidatePath("/people/structure/chart");

    return {
      status: "success",
      message: "Department created successfully.",
      entityId: departmentId,
    };
  } catch (error: unknown) {
    console.error("Unable to create department:", error);

    if (isUniqueConstraintError(error)) {
      return {
        status: "error",
        message: "A department with this name or code already exists.",
        fieldErrors: {
          name: "A department with this name already exists.",
        },
      };
    }

    return {
      status: "error",
      message: "The department could not be created.",
    };
  }
}

export async function updateDepartment(
  _previousState: StructureFormState,
  formData: FormData,
): Promise<StructureFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const id = textValue(formData, "id");
  const submittedUpdatedAt = textValue(formData, "updatedAt");
  const name = textValue(formData, "name");
  const code = nullableText(formData, "code");
  const description = nullableText(formData, "description");
  const isActive = formData.get("isActive") === "on";

  if (!id || !submittedUpdatedAt || name.length < 2) {
    return {
      status: "error",
      message: "The department information is incomplete.",
      fieldErrors:
        name.length < 2
          ? {
              name: "Department name must contain at least two characters.",
            }
          : undefined,
    };
  }

  try {
    const current = await prisma.department.findUnique({
      where: {
        id,
      },
    });

    if (!current) {
      return {
        status: "error",
        message: "The department no longer exists.",
      };
    }

    if (current.updatedAt.toISOString() !== submittedUpdatedAt) {
      return {
        status: "conflict",
        message:
          "This department was updated elsewhere. Refresh the page before saving.",
      };
    }

    const fieldErrors: NonNullable<StructureFormState["fieldErrors"]> = {};

    if (
      await findDepartmentNameConflict({
        organizationId: current.organizationId,
        name,
        excludeId: id,
      })
    ) {
      fieldErrors.name = "A department with this name already exists.";
    }

    if (
      code &&
      (await findDepartmentCodeConflict({
        organizationId: current.organizationId,
        code,
        excludeId: id,
      }))
    ) {
      fieldErrors.code = "A department with this code already exists.";
    }

    if (fieldErrors.name || fieldErrors.code) {
      return {
        status: "error",
        message:
          fieldErrors.name ??
          fieldErrors.code ??
          "A department with these details already exists.",
        fieldErrors,
      };
    }

    const metadata = await getAuditRequestMetadata(formData);

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
      });

      if (updateResult.count !== 1) {
        return false;
      }

      const updated = await transaction.department.findUniqueOrThrow({
        where: {
          id,
        },
      });

      await transaction.auditEvent.create({
        data: {
          userId: actor.actor.userId,
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
          clientHostName: metadata.clientHostName,
        },
      });

      return true;
    });

    if (!result) {
      return {
        status: "conflict",
        message:
          "This department changed while it was being saved. Refresh the page.",
      };
    }

    revalidatePath("/people/structure");
    revalidatePath("/people/structure/chart");
    revalidatePath(`/people/structure/departments/${id}`);
    revalidatePath(`/people/structure/departments/${id}/edit`);

    return {
      status: "success",
      message: "Department updated successfully.",
      entityId: id,
    };
  } catch (error: unknown) {
    console.error("Unable to update department:", error);

    if (isUniqueConstraintError(error)) {
      return {
        status: "error",
        message: "A department with this name or code already exists.",
        fieldErrors: {
          name: "A department with this name already exists.",
        },
      };
    }

    return {
      status: "error",
      message: "The department could not be updated.",
    };
  }
}

export async function createPosition(
  _previousState: StructureFormState,
  formData: FormData,
): Promise<StructureFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const departmentId = textValue(formData, "departmentId");
  const title = textValue(formData, "title");
  const code = nullableText(formData, "code");
  const description = nullableText(formData, "description");
  const systemRoleParsed = parsePositionSystemRoleCode(
    nullableText(formData, "systemRoleCode"),
  );

  if (!systemRoleParsed.ok) {
    return {
      status: "error",
      message: systemRoleParsed.message,
    };
  }

  const systemRoleCode = systemRoleParsed.code;

  if (!departmentId || title.length < 2) {
    return {
      status: "error",
      message: "Select a department and enter a valid title.",
    };
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
    });

    if (!department) {
      return {
        status: "error",
        message: "The selected department no longer exists.",
      };
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
    });

    if (duplicate) {
      return {
        status: "error",
        message: "A position with this title already exists in the department.",
      };
    }

    const metadata = await getAuditRequestMetadata(formData);

    const positionId = await prisma.$transaction(async (transaction) => {
      const position = await transaction.position.create({
        data: {
          departmentId,
          title,
          code,
          description,
          systemRoleCode,
          isActive: true,
        },
      });

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
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
          systemRoleCode: position.systemRoleCode,
          isActive: position.isActive,
        },
        ...metadata,
      });

      return position.id;
    });

    revalidatePath("/people/structure");
    revalidatePath("/people/structure/chart");
    revalidatePath("/people/employees", "layout");

    return {
      status: "success",
      message: "Position created successfully.",
      entityId: positionId,
      createdEntity: {
        id: positionId,
        title,
        departmentId,
      },
    };
  } catch (error: unknown) {
    console.error("Unable to create position:", error);

    return {
      status: "error",
      message: "The position could not be created.",
    };
  }
}

export async function updatePosition(
  _previousState: StructureFormState,
  formData: FormData,
): Promise<StructureFormState> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const id = textValue(formData, "id");
  const submittedUpdatedAt = textValue(formData, "updatedAt");
  const title = textValue(formData, "title");
  const code = nullableText(formData, "code");
  const description = nullableText(formData, "description");
  const systemRoleParsed = parsePositionSystemRoleCode(
    nullableText(formData, "systemRoleCode"),
  );
  const isActive = formData.get("isActive") === "on";

  if (!systemRoleParsed.ok) {
    return {
      status: "error",
      message: systemRoleParsed.message,
    };
  }

  const systemRoleCode = systemRoleParsed.code;

  if (!id || !submittedUpdatedAt || title.length < 2) {
    return {
      status: "error",
      message: "The position information is incomplete.",
    };
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
    });

    if (!current) {
      return {
        status: "error",
        message: "The position no longer exists.",
      };
    }

    if (current.updatedAt.toISOString() !== submittedUpdatedAt) {
      return {
        status: "conflict",
        message:
          "This position was updated elsewhere. Refresh the page before saving.",
      };
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
    });

    if (duplicate) {
      return {
        status: "error",
        message: "A position with this title already exists in the department.",
      };
    }

    const metadata = await getAuditRequestMetadata(formData);

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
          systemRoleCode,
          isActive,
        },
      });

      if (updateResult.count !== 1) {
        return false;
      }

      const updated = await transaction.position.findUniqueOrThrow({
        where: {
          id,
        },
      });

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "UPDATE",
        entityType: "Position",
        entityId: updated.id,
        description: `Updated position ${updated.title}.`,
        oldValues: {
          title: current.title,
          code: current.code,
          description: current.description,
          systemRoleCode: current.systemRoleCode,
          isActive: current.isActive,
        },
        newValues: {
          title: updated.title,
          code: updated.code,
          description: updated.description,
          systemRoleCode: updated.systemRoleCode,
          isActive: updated.isActive,
        },
        ...metadata,
      });

      return true;
    });

    if (!result) {
      return {
        status: "conflict",
        message:
          "This position changed while it was being saved. Refresh the page.",
      };
    }

    const holders = await prisma.employee.findMany({
      where: {
        positionId: id,
        user: {
          isNot: null,
        },
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    for (const holder of holders) {
      if (holder.user) {
        await syncEmployeeAccessRoles(holder.user.id, holder.id);
      }
    }

    revalidatePath("/people/structure");
    revalidatePath("/people/structure/chart");
    revalidatePath(`/people/structure/positions/${id}`);
    revalidatePath(`/people/structure/positions/${id}/edit`);

    return {
      status: "success",
      message: "Position updated successfully.",
    };
  } catch (error: unknown) {
    console.error("Unable to update position:", error);

    return {
      status: "error",
      message: "The position could not be updated.",
    };
  }
}
