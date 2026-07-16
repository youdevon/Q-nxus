import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "qnxus_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export type SessionPayload = {
  userId: string;
  expiresAt: number;
  mustChangePassword: boolean;
};

export type SessionOptions = {
  mustChangePassword?: boolean;
};

function requireSessionSecret(): string {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is not configured. Add a secret of at least 16 characters to .env.",
    );
  }

  return secret;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionToken(
  userId: string,
  options: SessionOptions = {},
): string {
  const secret = requireSessionSecret();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const mustChangePassword = options.mustChangePassword ? "1" : "0";
  const body = `${userId}.${expiresAt}.${mustChangePassword}`;
  return `${body}.${sign(body, secret)}`;
}

function parseSessionParts(token: string): {
  userId: string;
  expiresAtRaw: string;
  mustChangePasswordRaw: string;
  signature: string;
  body: string;
} | null {
  const parts = token.split(".");

  // Current format: userId.expiresAt.mustChangePassword.signature
  if (parts.length === 4) {
    const [userId, expiresAtRaw, mustChangePasswordRaw, signature] = parts;

    if (!userId || !expiresAtRaw || !mustChangePasswordRaw || !signature) {
      return null;
    }

    return {
      userId,
      expiresAtRaw,
      mustChangePasswordRaw,
      signature,
      body: `${userId}.${expiresAtRaw}.${mustChangePasswordRaw}`,
    };
  }

  // Legacy format: userId.expiresAt.signature
  if (parts.length === 3) {
    const [userId, expiresAtRaw, signature] = parts;

    if (!userId || !expiresAtRaw || !signature) {
      return null;
    }

    return {
      userId,
      expiresAtRaw,
      mustChangePasswordRaw: "0",
      signature,
      body: `${userId}.${expiresAtRaw}`,
    };
  }

  return null;
}

export function parseSessionToken(
  token: string | undefined | null,
): SessionPayload | null {
  if (!token) {
    return null;
  }

  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 16) {
    return null;
  }

  const parts = parseSessionParts(token);

  if (!parts) {
    return null;
  }

  const expected = sign(parts.body, secret);
  const provided = Buffer.from(parts.signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    provided.length !== expectedBuffer.length ||
    !timingSafeEqual(provided, expectedBuffer)
  ) {
    return null;
  }

  const expiresAt = Number(parts.expiresAtRaw);

  if (!Number.isFinite(expiresAt) || expiresAt * 1000 <= Date.now()) {
    return null;
  }

  return {
    userId: parts.userId,
    expiresAt,
    mustChangePassword: parts.mustChangePasswordRaw === "1",
  };
}

/** Edge-safe verification using Web Crypto (for proxy.ts). */
export async function parseSessionTokenEdge(
  token: string | undefined | null,
  secret: string,
): Promise<SessionPayload | null> {
  if (!token || !secret) {
    return null;
  }

  const parts = parseSessionParts(token);

  if (!parts) {
    return null;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(parts.body),
  );

  const expected = arrayBufferToBase64Url(signed);

  if (expected !== parts.signature) {
    return null;
  }

  const expiresAt = Number(parts.expiresAtRaw);

  if (!Number.isFinite(expiresAt) || expiresAt * 1000 <= Date.now()) {
    return null;
  }

  return {
    userId: parts.userId,
    expiresAt,
    mustChangePassword: parts.mustChangePasswordRaw === "1",
  };
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}
