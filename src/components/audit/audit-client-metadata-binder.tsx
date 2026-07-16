"use client";

import { useEffect } from "react";

import {
  CLIENT_HOSTNAME_COOKIE,
  CLIENT_HOSTNAME_FIELD,
} from "@/src/lib/audit-constants";

const STORAGE_KEY = "q-nxus.clientHostName";

/**
 * Best-effort binder: if a workstation name was stored (e.g. by a desktop
 * agent or future settings UI), mirror it into a cookie so server actions
 * can attach it to audit events without every form wiring a hidden field.
 */
export function AuditClientMetadataBinder() {
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY)?.trim();
      if (!stored) {
        return;
      }

      document.cookie = `${CLIENT_HOSTNAME_COOKIE}=${encodeURIComponent(stored)}; path=/; SameSite=Lax; Max-Age=86400`;
    } catch {
      // Ignore storage / cookie failures in restricted contexts.
    }
  }, []);

  return null;
}

/** Persist a client-provided workstation name for subsequent audit writes. */
export function setClientHostName(hostName: string) {
  const cleaned = hostName.trim().slice(0, 255);
  if (!cleaned) {
    return;
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, cleaned);
    document.cookie = `${CLIENT_HOSTNAME_COOKIE}=${encodeURIComponent(cleaned)}; path=/; SameSite=Lax; Max-Age=86400`;
  } catch {
    // no-op
  }
}

/** Append optional hostname to FormData for server actions. */
export function appendClientHostName(formData: FormData) {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY)?.trim();
    if (stored && !formData.get(CLIENT_HOSTNAME_FIELD)) {
      formData.set(CLIENT_HOSTNAME_FIELD, stored);
    }
  } catch {
    // no-op
  }
}
