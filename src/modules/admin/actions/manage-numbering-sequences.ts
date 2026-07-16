"use server";

import { revalidatePath } from "next/cache";

import { SequenceResetFrequency } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";

export type NumberingSequenceFormState = {
  status: "idle" | "success" | "error" | "conflict";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

export async function saveNumberingSequences(
  _previousState: NumberingSequenceFormState,
  formData: FormData,
): Promise<NumberingSequenceFormState> {
  const actor = await requireActor(
    "administration.manage",
    "administration.manage_sequence",
  );

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const sequenceIds = formData
    .getAll("sequenceIds")
    .filter((value): value is string => typeof value === "string");

  if (sequenceIds.length === 0) {
    return {
      status: "error",
      message: "No numbering sequences were submitted.",
    };
  }

  try {
    const { ipAddress, userAgent, clientHostName } =
      await getAuditRequestMetadata(formData);

    const result = await prisma.$transaction(async (transaction) => {
      for (const sequenceId of sequenceIds) {
        const submittedVersion = Number(
          textValue(formData, `version:${sequenceId}`),
        );

        const current = await transaction.numberingSequence.findUnique({
          where: {
            id: sequenceId,
          },
        });

        if (!current) {
          return {
            outcome: "missing" as const,
          };
        }

        if (
          !Number.isInteger(submittedVersion) ||
          current.version !== submittedVersion
        ) {
          return {
            outcome: "conflict" as const,
          };
        }

        const prefix = nullableText(formData, `prefix:${sequenceId}`);
        const suffix = nullableText(formData, `suffix:${sequenceId}`);
        const minimumLength = Number(
          textValue(formData, `minimumLength:${sequenceId}`),
        );
        const resetFrequencyValue = textValue(
          formData,
          `resetFrequency:${sequenceId}`,
        );
        const isActive = formData.get(`isActive:${sequenceId}`) === "on";

        if (
          !Number.isInteger(minimumLength) ||
          minimumLength < 1 ||
          minimumLength > 20
        ) {
          return {
            outcome: "invalid-length" as const,
          };
        }

        if (
          !Object.values(SequenceResetFrequency).includes(
            resetFrequencyValue as SequenceResetFrequency,
          )
        ) {
          return {
            outcome: "invalid-frequency" as const,
          };
        }

        if ((prefix?.length ?? 0) > 30 || (suffix?.length ?? 0) > 30) {
          return {
            outcome: "invalid-affix" as const,
          };
        }

        const updateResult = await transaction.numberingSequence.updateMany({
          where: {
            id: sequenceId,
            version: submittedVersion,
          },
          data: {
            prefix,
            suffix,
            minimumLength,
            resetFrequency: resetFrequencyValue as SequenceResetFrequency,
            isActive,
            version: {
              increment: 1,
            },
          },
        });

        if (updateResult.count !== 1) {
          return {
            outcome: "conflict" as const,
          };
        }

        const updated = await transaction.numberingSequence.findUniqueOrThrow({
          where: {
            id: sequenceId,
          },
        });

        const changed =
          current.prefix !== updated.prefix ||
          current.suffix !== updated.suffix ||
          current.minimumLength !== updated.minimumLength ||
          current.resetFrequency !== updated.resetFrequency ||
          current.isActive !== updated.isActive;

        if (changed) {
          await transaction.auditEvent.create({
            data: {
              userId: actor.actor.userId,
              moduleKey: "administration",
              action: "UPDATE",
              entityType: "NumberingSequence",
              entityId: updated.id,
              description: `Updated numbering sequence ${updated.sequenceCode}.`,
              oldValues: {
                sequenceCode: current.sequenceCode,
                prefix: current.prefix,
                suffix: current.suffix,
                currentNumber: current.currentNumber.toString(),
                minimumLength: current.minimumLength,
                resetFrequency: current.resetFrequency,
                isActive: current.isActive,
                version: current.version,
              },
              newValues: {
                sequenceCode: updated.sequenceCode,
                prefix: updated.prefix,
                suffix: updated.suffix,
                currentNumber: updated.currentNumber.toString(),
                minimumLength: updated.minimumLength,
                resetFrequency: updated.resetFrequency,
                isActive: updated.isActive,
                version: updated.version,
              },
              ipAddress,
              userAgent,
              clientHostName,
            },
          });
        }
      }

      return {
        outcome: "updated" as const,
      };
    });

    if (result.outcome === "missing") {
      return {
        status: "error",
        message: "A numbering sequence no longer exists.",
      };
    }

    if (result.outcome === "conflict") {
      return {
        status: "conflict",
        message:
          "A numbering sequence was updated elsewhere. Refresh the page before saving again.",
      };
    }

    if (result.outcome === "invalid-length") {
      return {
        status: "error",
        message: "Minimum length must be between 1 and 20.",
      };
    }

    if (result.outcome === "invalid-frequency") {
      return {
        status: "error",
        message: "An invalid reset frequency was submitted.",
      };
    }

    if (result.outcome === "invalid-affix") {
      return {
        status: "error",
        message: "Prefixes and suffixes must not exceed 30 characters.",
      };
    }

    revalidatePath("/administration/numbering-sequences");

    return {
      status: "success",
      message: "Numbering sequences saved successfully.",
    };
  } catch (error: unknown) {
    console.error("Unable to save numbering sequences:", error);

    return {
      status: "error",
      message:
        "Numbering sequences could not be saved. Check the server log and try again.",
    };
  }
}

export async function resetNumberingSequence(
  formData: FormData,
): Promise<void> {
  const actor = await requireActor(
    "administration.manage",
    "administration.manage_sequence",
  );

  if (!actor.ok) {
    throw new Error(actor.message);
  }

  const id = textValue(formData, "id");
  const submittedVersion = Number(textValue(formData, "version"));

  if (!id || !Number.isInteger(submittedVersion)) {
    return;
  }

  const { ipAddress, userAgent, clientHostName } =
    await getAuditRequestMetadata(formData);

  await prisma.$transaction(async (transaction) => {
    const current = await transaction.numberingSequence.findUnique({
      where: {
        id,
      },
    });

    if (!current || current.version !== submittedVersion) {
      return;
    }

    const updateResult = await transaction.numberingSequence.updateMany({
      where: {
        id,
        version: submittedVersion,
      },
      data: {
        currentNumber: BigInt(0),
        lastResetAt: new Date(),
        version: {
          increment: 1,
        },
      },
    });

    if (updateResult.count !== 1) {
      return;
    }

    const updated = await transaction.numberingSequence.findUniqueOrThrow({
      where: {
        id,
      },
    });

    await transaction.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "administration",
        action: "RESET",
        entityType: "NumberingSequence",
        entityId: updated.id,
        description: `Reset numbering sequence ${updated.sequenceCode}.`,
        oldValues: {
          currentNumber: current.currentNumber.toString(),
          lastResetAt: current.lastResetAt,
          version: current.version,
        },
        newValues: {
          currentNumber: updated.currentNumber.toString(),
          lastResetAt: updated.lastResetAt,
          version: updated.version,
        },
        ipAddress,
        userAgent,
        clientHostName,
      },
    });
  });

  revalidatePath("/administration/numbering-sequences");
}
