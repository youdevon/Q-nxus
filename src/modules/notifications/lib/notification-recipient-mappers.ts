import type { SystemNotificationRecipient } from "@/src/modules/notifications/services/create-system-notification";

export type NotificationPermissionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type ResolveRecipientsOptions = {
  /** User ids to omit (typically the acting user). */
  excludeUserIds?: Iterable<string>;
  /** Default false for staff in-app alerts. */
  sendEmail?: boolean;
};

function excludeSet(excludeUserIds?: Iterable<string>): Set<string> {
  return new Set(
    [...(excludeUserIds ?? [])].filter((id) => typeof id === "string" && id.length > 0),
  );
}

/** Map permission users to notification recipients, optionally excluding actors. */
export function toNotificationRecipients(
  users: NotificationPermissionUser[],
  options?: ResolveRecipientsOptions,
): SystemNotificationRecipient[] {
  const excluded = excludeSet(options?.excludeUserIds);
  const sendEmail = options?.sendEmail ?? false;

  return users
    .filter((user) => !excluded.has(user.id))
    .map((user) => ({
      userId: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      sendEmail,
    }));
}

/** Build recipients from explicit active user rows (maker/checker/employee). */
export function recipientsFromUsers(
  users: Array<{
    id: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    isActive?: boolean;
  } | null | undefined>,
  options?: ResolveRecipientsOptions,
): SystemNotificationRecipient[] {
  const excluded = excludeSet(options?.excludeUserIds);
  const sendEmail = options?.sendEmail ?? false;
  const mapped: SystemNotificationRecipient[] = [];

  for (const user of users) {
    if (!user || user.isActive === false || excluded.has(user.id)) {
      continue;
    }
    mapped.push({
      userId: user.id,
      email: user.email ?? null,
      name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || null,
      sendEmail,
    });
  }

  return [...new Map(mapped.map((row) => [row.userId, row])).values()];
}

/** Merge recipient lists and dedupe by userId (later entries win). */
export function mergeNotificationRecipients(
  ...lists: SystemNotificationRecipient[][]
): SystemNotificationRecipient[] {
  const map = new Map<string, SystemNotificationRecipient>();
  for (const list of lists) {
    for (const recipient of list) {
      map.set(recipient.userId, recipient);
    }
  }
  return [...map.values()];
}
