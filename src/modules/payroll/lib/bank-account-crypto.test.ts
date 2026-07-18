import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BANK_ACCOUNT_CIPHER_PREFIX,
  decryptAccountNumber,
  encryptAccountNumber,
  isEncryptedAccountNumber,
  maskAccountNumberForLog,
} from "./bank-account-crypto";

describe("bank-account-crypto", () => {
  const previousAuth = process.env.AUTH_SECRET;
  const previousBank = process.env.BANK_ACCOUNT_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-16chars";
    delete process.env.BANK_ACCOUNT_ENCRYPTION_KEY;
  });

  afterEach(() => {
    if (previousAuth === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = previousAuth;
    }
    if (previousBank === undefined) {
      delete process.env.BANK_ACCOUNT_ENCRYPTION_KEY;
    } else {
      process.env.BANK_ACCOUNT_ENCRYPTION_KEY = previousBank;
    }
  });

  it("round-trips plaintext through encrypt/decrypt", () => {
    const encrypted = encryptAccountNumber("111122223333");
    expect(encrypted).toBeTruthy();
    expect(isEncryptedAccountNumber(encrypted)).toBe(true);
    expect(encrypted!.startsWith(BANK_ACCOUNT_CIPHER_PREFIX)).toBe(true);
    expect(encrypted).not.toContain("111122223333");
    expect(decryptAccountNumber(encrypted)).toBe("111122223333");
  });

  it("passes through legacy plaintext on decrypt", () => {
    expect(decryptAccountNumber("999988887777")).toBe("999988887777");
  });

  it("is idempotent on already-encrypted values", () => {
    const once = encryptAccountNumber("1234567890")!;
    const twice = encryptAccountNumber(once);
    expect(twice).toBe(once);
  });

  it("prefers BANK_ACCOUNT_ENCRYPTION_KEY over AUTH_SECRET", () => {
    const withAuth = encryptAccountNumber("555566667777")!;
    process.env.BANK_ACCOUNT_ENCRYPTION_KEY = "dedicated-bank-key-32b!";
    const withDedicated = encryptAccountNumber("555566667777")!;
    expect(withDedicated).not.toBe(withAuth);
    expect(decryptAccountNumber(withDedicated)).toBe("555566667777");
  });

  it("masks for logs without exposing full number", () => {
    const encrypted = encryptAccountNumber("111122223333");
    const masked = maskAccountNumberForLog(encrypted);
    expect(masked).toBe("••••3333");
    expect(masked).not.toContain("1111");
  });
});
