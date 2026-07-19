import { describe, expect, it } from "vitest";

import {
  MISSING_FILE_REMINDER_DEDUPE_DAYS,
  addUtcDays,
  buildMissingFileReminderMessage,
} from "@/src/modules/hr/lib/missing-file-reminder";

describe("missing file reminder", () => {
  it("builds a stable message listing missing labels", () => {
    expect(
      buildMissingFileReminderMessage([
        "Copy of your ID",
        "Academic Certificates",
      ]),
    ).toBe(
      "Your employee file is missing: Copy of your ID, Academic Certificates. Please upload or complete these items via My documents, or contact HR.",
    );
  });

  it("uses a 14-day dedupe window helper", () => {
    const asOf = new Date("2026-07-17T12:00:00.000Z");
    const since = addUtcDays(asOf, -MISSING_FILE_REMINDER_DEDUPE_DAYS);
    expect(since.toISOString().slice(0, 10)).toBe("2026-07-03");
  });
});
