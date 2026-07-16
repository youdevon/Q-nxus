import { cookies, headers } from "next/headers";

import {
  CLIENT_HOSTNAME_COOKIE,
  CLIENT_HOSTNAME_FIELD,
  CLIENT_HOSTNAME_HEADER,
} from "@/src/lib/audit-constants";

export type AuditRequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
  clientHostName: string | null;
};

const IPV4_PATTERN =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

/**
 * Prefer a public/client IPv4 address from proxy headers.
 * Strips IPv6-mapped IPv4 (`::ffff:a.b.c.d`) and skips pure IPv6.
 */
export function normalizeClientIp(
  raw: string | null | undefined,
): string | null {
  if (!raw) {
    return null;
  }

  for (const part of raw.split(",")) {
    let candidate = part.trim();

    if (!candidate) {
      continue;
    }

    if (candidate.startsWith("[") && candidate.endsWith("]")) {
      candidate = candidate.slice(1, -1);
    }

    const mappedPrefix = "::ffff:";
    if (candidate.toLowerCase().startsWith(mappedPrefix)) {
      candidate = candidate.slice(mappedPrefix.length);
    }

    if (IPV4_PATTERN.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

function cleanHostName(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().slice(0, 255);
  return trimmed.length > 0 ? trimmed : null;
}

async function resolveClientHostName(
  formData?: FormData,
): Promise<string | null> {
  const requestHeaders = await headers();
  const fromHeader = cleanHostName(requestHeaders.get(CLIENT_HOSTNAME_HEADER));

  if (fromHeader) {
    return fromHeader;
  }

  if (formData) {
    const fromForm = formData.get(CLIENT_HOSTNAME_FIELD);
    if (typeof fromForm === "string") {
      const cleaned = cleanHostName(fromForm);
      if (cleaned) {
        return cleaned;
      }
    }
  }

  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(CLIENT_HOSTNAME_COOKIE)?.value;
    if (!raw) {
      return null;
    }

    try {
      return cleanHostName(decodeURIComponent(raw));
    } catch {
      return cleanHostName(raw);
    }
  } catch {
    return null;
  }
}

/**
 * Shared audit actor context from the incoming request.
 * Pass `formData` when available so optional `clientHostName` can be read.
 */
export async function getAuditRequestMetadata(
  formData?: FormData,
): Promise<AuditRequestMetadata> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const realIp = requestHeaders.get("x-real-ip");

  return {
    ipAddress:
      normalizeClientIp(forwarded) ?? normalizeClientIp(realIp) ?? null,
    userAgent: requestHeaders.get("user-agent"),
    clientHostName: await resolveClientHostName(formData),
  };
}
