/**
 * App-level AES-256-GCM encryption for bank account numbers at rest.
 * Ciphertext is version-prefixed: `v1:<base64(iv|tag|ciphertext)>`.
 *
 * Key resolution: BANK_ACCOUNT_ENCRYPTION_KEY → AUTH_SECRET.
 * Legacy plaintext values decrypt as-is (pass-through) until migrated.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const BANK_ACCOUNT_CIPHER_PREFIX = "v1:";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function resolveEncryptionKeyMaterial(): string {
  const dedicated = process.env.BANK_ACCOUNT_ENCRYPTION_KEY?.trim();
  if (dedicated && dedicated.length >= 16) {
    return dedicated;
  }
  const authSecret = process.env.AUTH_SECRET?.trim();
  if (authSecret && authSecret.length >= 16) {
    return authSecret;
  }
  throw new Error(
    "Bank account encryption requires BANK_ACCOUNT_ENCRYPTION_KEY or AUTH_SECRET (min 16 characters).",
  );
}

function deriveKey(): Buffer {
  return createHash("sha256").update(resolveEncryptionKeyMaterial(), "utf8").digest();
}

export function isEncryptedAccountNumber(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(BANK_ACCOUNT_CIPHER_PREFIX);
}

/**
 * Encrypt a plaintext account number. Empty/null inputs return null.
 * Idempotent: already-encrypted values are returned unchanged.
 */
export function encryptAccountNumber(
  plaintext: string | null | undefined,
): string | null {
  if (plaintext == null) {
    return null;
  }
  const trimmed = plaintext.trim();
  if (!trimmed) {
    return null;
  }
  if (isEncryptedAccountNumber(trimmed)) {
    return trimmed;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(trimmed, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]);
  return `${BANK_ACCOUNT_CIPHER_PREFIX}${payload.toString("base64url")}`;
}

/**
 * Decrypt a stored value. Legacy plaintext (no version prefix) is returned as-is.
 */
export function decryptAccountNumber(
  stored: string | null | undefined,
): string | null {
  if (stored == null) {
    return null;
  }
  const trimmed = stored.trim();
  if (!trimmed) {
    return null;
  }
  if (!isEncryptedAccountNumber(trimmed)) {
    return trimmed;
  }

  const encoded = trimmed.slice(BANK_ACCOUNT_CIPHER_PREFIX.length);
  const payload = Buffer.from(encoded, "base64url");
  if (payload.length <= IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid encrypted bank account payload.");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const data = payload.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, deriveKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Safe for logs / audit — never returns plaintext digits beyond last four. */
export function maskAccountNumberForLog(value: string | null | undefined): string {
  const plaintext = (() => {
    try {
      return decryptAccountNumber(value);
    } catch {
      return null;
    }
  })();
  if (!plaintext) {
    return "••••";
  }
  const digits = plaintext.replace(/\D/g, "");
  if (digits.length >= 4) {
    return `••••${digits.slice(-4)}`;
  }
  return "••••";
}
