export const CORRESPONDENCE_BACKFILL_NOTIFICATION_TITLE = "Letter received";
export const CORRESPONDENCE_NOTIFICATION_RELATED_TYPE =
  "EmployeeCorrespondence";

export type BackfillCorrespondenceStatus = "ISSUED" | "ACKNOWLEDGED";

export function correspondenceNotificationActionUrl(
  correspondenceId: string,
): string {
  return `/me/documents/${correspondenceId}`;
}

export function correspondenceNotificationIdentity(
  correspondenceId: string,
): {
  actionUrl: string;
  relatedType: typeof CORRESPONDENCE_NOTIFICATION_RELATED_TYPE;
  relatedId: string;
} {
  return {
    actionUrl: correspondenceNotificationActionUrl(correspondenceId),
    relatedType: CORRESPONDENCE_NOTIFICATION_RELATED_TYPE,
    relatedId: correspondenceId,
  };
}

export function historicalRecipientReadState(
  status: BackfillCorrespondenceStatus,
  acknowledgedAt: Date | null,
  fallbackReadAt: Date,
): { status: "UNREAD" | "READ"; readAt: Date | null } {
  if (status === "ACKNOWLEDGED") {
    return {
      status: "READ",
      readAt: acknowledgedAt ?? fallbackReadAt,
    };
  }

  return { status: "UNREAD", readAt: null };
}
