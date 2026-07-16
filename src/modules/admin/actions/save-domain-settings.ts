"use server";

import { revalidatePath } from "next/cache";

import {
  ConfigurationStatus,
  Prisma,
  SettingDataType,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";

export type DomainSettingsFormState = {
  status: "idle" | "success" | "error" | "conflict";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseSettingValue(
  dataType: SettingDataType,
  rawValue: string,
): {
  valid: boolean;
  value?: string | number | boolean | null | object;
} {
  switch (dataType) {
    case SettingDataType.STRING:
      return {
        valid: true,
        value: rawValue,
      };

    case SettingDataType.INTEGER: {
      if (!/^-?\d+$/.test(rawValue)) {
        return {
          valid: false,
        };
      }

      const value = Number(rawValue);

      return {
        valid: Number.isSafeInteger(value),
        value,
      };
    }

    case SettingDataType.DECIMAL: {
      if (!/^-?(?:\d+|\d*\.\d+)$/.test(rawValue)) {
        return {
          valid: false,
        };
      }

      const value = Number(rawValue);

      return {
        valid: Number.isFinite(value),
        value,
      };
    }

    case SettingDataType.BOOLEAN:
      if (rawValue !== "true" && rawValue !== "false") {
        return {
          valid: false,
        };
      }

      return {
        valid: true,
        value: rawValue === "true",
      };

    case SettingDataType.DATE: {
      const parsed = parseDate(rawValue);

      return {
        valid: Boolean(parsed),
        value: rawValue,
      };
    }

    case SettingDataType.DATETIME: {
      const parsed = new Date(rawValue);

      return {
        valid: !Number.isNaN(parsed.getTime()),
        value: parsed.toISOString(),
      };
    }

    case SettingDataType.JSON:
      try {
        const value: unknown = JSON.parse(rawValue);

        if (
          value === null ||
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          Array.isArray(value) ||
          typeof value === "object"
        ) {
          return {
            valid: true,
            value: value as string | number | boolean | null | object,
          };
        }

        return {
          valid: false,
        };
      } catch {
        return {
          valid: false,
        };
      }
  }
}

export async function saveDomainSettings(
  _previousState: DomainSettingsFormState,
  formData: FormData,
): Promise<DomainSettingsFormState> {
  const actor = await requireActor(
    "administration.manage",
    "administration.manage_domain_setting",
  );

  if (!actor.ok) {
    return {
      status: "error",
      message: actor.message,
    };
  }

  const settingIds = formData
    .getAll("settingIds")
    .filter((value): value is string => typeof value === "string");

  if (settingIds.length === 0) {
    return {
      status: "error",
      message: "No settings were submitted.",
    };
  }

  try {
    const { ipAddress, userAgent, clientHostName } =
      await getAuditRequestMetadata(formData);

    const result = await prisma.$transaction(async (transaction) => {
      for (const settingId of settingIds) {
        const submittedVersion = Number(
          textValue(formData, `version:${settingId}`),
        );

        const current = await transaction.domainSetting.findUnique({
          where: {
            id: settingId,
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

        const statusValue = textValue(formData, `status:${settingId}`);

        if (
          !Object.values(ConfigurationStatus).includes(
            statusValue as ConfigurationStatus,
          )
        ) {
          return {
            outcome: "invalid-status" as const,
          };
        }

        const effectiveFrom =
          parseDate(textValue(formData, `effectiveFrom:${settingId}`)) ??
          current.effectiveFrom;

        const effectiveUntil = parseDate(
          textValue(formData, `effectiveUntil:${settingId}`),
        );

        if (effectiveUntil && effectiveUntil < effectiveFrom) {
          return {
            outcome: "invalid-date" as const,
          };
        }

        const rawValue =
          current.dataType === SettingDataType.BOOLEAN
            ? formData.get(`value:${settingId}`) === "on"
              ? "true"
              : "false"
            : textValue(formData, `value:${settingId}`);

        const parsedValue = parseSettingValue(current.dataType, rawValue);

        if (!parsedValue.valid) {
          return {
            outcome: "invalid-value" as const,
            settingName: current.name,
            dataType: current.dataType,
          };
        }

        const updateResult = await transaction.domainSetting.updateMany({
          where: {
            id: settingId,
            version: submittedVersion,
          },
          data: {
            value:
              parsedValue.value === null
                ? Prisma.JsonNull
                : (parsedValue.value as Prisma.InputJsonValue),
            status: statusValue as ConfigurationStatus,
            effectiveFrom,
            effectiveUntil,
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

        const updated = await transaction.domainSetting.findUniqueOrThrow({
          where: {
            id: settingId,
          },
        });

        const changed =
          JSON.stringify(current.value) !== JSON.stringify(updated.value) ||
          current.status !== updated.status ||
          current.effectiveFrom.getTime() !== updated.effectiveFrom.getTime() ||
          current.effectiveUntil?.getTime() !==
            updated.effectiveUntil?.getTime();

        if (changed) {
          await transaction.auditEvent.create({
            data: {
              userId: actor.actor.userId,
              moduleKey: "administration",
              action: "UPDATE",
              entityType: "DomainSetting",
              entityId: updated.id,
              description: `Updated domain setting ${updated.settingCode}.`,
              oldValues: current.isSensitive
                ? {
                    settingCode: current.settingCode,
                    value: "[REDACTED]",
                    status: current.status,
                    effectiveFrom: current.effectiveFrom,
                    effectiveUntil: current.effectiveUntil,
                    version: current.version,
                  }
                : {
                    settingCode: current.settingCode,
                    value: current.value,
                    status: current.status,
                    effectiveFrom: current.effectiveFrom,
                    effectiveUntil: current.effectiveUntil,
                    version: current.version,
                  },
              newValues: updated.isSensitive
                ? {
                    settingCode: updated.settingCode,
                    value: "[REDACTED]",
                    status: updated.status,
                    effectiveFrom: updated.effectiveFrom,
                    effectiveUntil: updated.effectiveUntil,
                    version: updated.version,
                  }
                : {
                    settingCode: updated.settingCode,
                    value: updated.value,
                    status: updated.status,
                    effectiveFrom: updated.effectiveFrom,
                    effectiveUntil: updated.effectiveUntil,
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
        message: "A setting no longer exists. Refresh the page.",
      };
    }

    if (result.outcome === "conflict") {
      return {
        status: "conflict",
        message:
          "A setting was updated elsewhere. Refresh the page before saving again.",
      };
    }

    if (result.outcome === "invalid-status") {
      return {
        status: "error",
        message: "An invalid setting status was submitted.",
      };
    }

    if (result.outcome === "invalid-date") {
      return {
        status: "error",
        message:
          "An effective-until date cannot be before its effective-from date.",
      };
    }

    if (result.outcome === "invalid-value") {
      return {
        status: "error",
        message: `${result.settingName} does not contain a valid ${result.dataType.toLowerCase()} value.`,
      };
    }

    revalidatePath("/administration/settings");

    return {
      status: "success",
      message: "Domain settings saved successfully.",
    };
  } catch (error: unknown) {
    console.error("Unable to save domain settings:", error);

    return {
      status: "error",
      message:
        "Domain settings could not be saved. Check the server log and try again.",
    };
  }
}
