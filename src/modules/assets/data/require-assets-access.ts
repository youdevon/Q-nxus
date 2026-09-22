import { notFound, redirect } from "next/navigation";

import { isFeatureEnabled } from "@/src/modules/admin/lib/feature-control";
import {
  getUserCapabilities,
  type UserCapabilities,
} from "@/src/modules/auth/data/get-user-capabilities";

export const ASSETS_VIEW_CAPABILITIES = [
  "assets.view",
  "assets.manage",
] as const;

export async function requireAssetsViewAccess(): Promise<UserCapabilities> {
  const [enabled, capabilities] = await Promise.all([
    isFeatureEnabled("assets"),
    getUserCapabilities(),
  ]);

  if (!enabled) {
    notFound();
  }

  if (!capabilities) {
    redirect("/login");
  }

  if (!capabilities.canAny(...ASSETS_VIEW_CAPABILITIES)) {
    notFound();
  }

  return capabilities;
}

export async function requireAssetsManageAccess(): Promise<UserCapabilities> {
  const [enabled, capabilities] = await Promise.all([
    isFeatureEnabled("assets"),
    getUserCapabilities(),
  ]);

  if (!enabled) {
    notFound();
  }

  if (!capabilities) {
    redirect("/login");
  }

  if (!capabilities.can("assets.manage")) {
    notFound();
  }

  return capabilities;
}
