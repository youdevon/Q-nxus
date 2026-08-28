import { NextResponse } from "next/server";

import { getUserCapabilities } from "@/src/modules/auth/data/get-user-capabilities";
import { searchEmployeeDirectoryLive } from "@/src/modules/hr/data/get-employees";

export const dynamic = "force-dynamic";

/**
 * Live People directory search. Returns JSON matches as the user types —
 * avoids depending on App Router soft-navigation for partial search.
 */
export async function GET(request: Request) {
  const capabilities = await getUserCapabilities();

  if (!capabilities?.canAny("people.directory.view", "people.manage")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ employees: [] });
  }

  try {
    const employees = await searchEmployeeDirectoryLive(query);
    return NextResponse.json({ employees });
  } catch (error) {
    console.error("GET /api/people/search failed:", error);
    return NextResponse.json(
      { error: "search_failed", employees: [] },
      { status: 500 },
    );
  }
}
