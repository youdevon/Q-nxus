import { NextResponse } from "next/server";

import { getNotificationBellState } from "@/src/modules/notifications/data/get-notification-bell-state";

export const dynamic = "force-dynamic";

/**
 * Lightweight JSON endpoint for the header notification bell.
 * Prefer this over a Server Action: actions POST to the current page URL and
 * frequently fail on dynamic routes under Turbopack with
 * "An unexpected response was received from the server."
 */
export async function GET() {
  try {
    const state = await getNotificationBellState();
    return NextResponse.json(state);
  } catch (error) {
    console.error("GET /api/notifications/bell failed:", error);
    return NextResponse.json(
      {
        unreadCount: 0,
        notifications: [],
        unreadActionUrls: [],
      },
      { status: 200 },
    );
  }
}
