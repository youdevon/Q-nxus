import {
  findUsersWithAnyPermission,
  findUsersWithPermission,
} from "@/src/modules/hr/data/find-users-with-permission";
import type { SystemNotificationRecipient } from "@/src/modules/notifications/services/create-system-notification";
import {
  toNotificationRecipients,
  type ResolveRecipientsOptions,
} from "@/src/modules/notifications/lib/notification-recipient-mappers";

export {
  mergeNotificationRecipients,
  recipientsFromUsers,
  toNotificationRecipients,
  type NotificationPermissionUser,
  type ResolveRecipientsOptions,
} from "@/src/modules/notifications/lib/notification-recipient-mappers";

/** Org-scoped users with any of the permissions, as notification recipients. */
export async function resolveRecipientsByPermissions(
  organizationId: string,
  permissionCodes: string | string[],
  options?: ResolveRecipientsOptions,
): Promise<SystemNotificationRecipient[]> {
  const codes = Array.isArray(permissionCodes)
    ? permissionCodes
    : [permissionCodes];
  const users = await findUsersWithAnyPermission(organizationId, codes);
  return toNotificationRecipients(users, options);
}

/** Single-permission convenience wrapper. */
export async function resolveRecipientsByPermission(
  organizationId: string,
  permissionCode: string,
  options?: ResolveRecipientsOptions,
): Promise<SystemNotificationRecipient[]> {
  const users = await findUsersWithPermission(organizationId, permissionCode);
  return toNotificationRecipients(users, options);
}
