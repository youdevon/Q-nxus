import { appConfig } from "@/src/config/app.config";

export type SmtpConfiguration = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  connectionTimeoutMs: number;
  maxConnections: number;
};

function booleanValue(
  value: string | undefined,
  defaultValue = false,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return value.trim().toLowerCase() === "true";
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function getSmtpConfiguration(): SmtpConfiguration {
  return {
    enabled: booleanValue(process.env.SMTP_ENABLED),
    host: process.env.SMTP_HOST?.trim() ?? "",
    port: positiveInteger(process.env.SMTP_PORT, 587),
    secure: booleanValue(process.env.SMTP_SECURE),
    username: process.env.SMTP_USERNAME?.trim() ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
    fromName: process.env.SMTP_FROM_NAME?.trim() || appConfig.displayName,
    fromEmail: process.env.SMTP_FROM_EMAIL?.trim() ?? "",
    replyTo: process.env.SMTP_REPLY_TO?.trim() || null,
    connectionTimeoutMs: positiveInteger(
      process.env.SMTP_CONNECTION_TIMEOUT_MS,
      15000,
    ),
    maxConnections: positiveInteger(process.env.SMTP_MAX_CONNECTIONS, 3),
  };
}

export function validateSmtpConfiguration(
  configuration = getSmtpConfiguration(),
): string[] {
  const errors: string[] = [];

  if (!configuration.enabled) {
    errors.push("SMTP delivery is disabled.");
    return errors;
  }

  if (!configuration.host) {
    errors.push("SMTP_HOST is not configured.");
  }

  if (!configuration.username) {
    errors.push("SMTP_USERNAME is not configured.");
  }

  if (!configuration.password) {
    errors.push("SMTP_PASSWORD is not configured.");
  }

  if (!configuration.fromEmail) {
    errors.push("SMTP_FROM_EMAIL is not configured.");
  }

  if (!Number.isInteger(configuration.port) || configuration.port <= 0) {
    errors.push("SMTP_PORT is invalid.");
  }

  return errors;
}
