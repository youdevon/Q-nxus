import { describe, expect, it } from "vitest";

import {
  DEFAULT_LEAVE_FORFEITURE_SETTINGS,
  parseLeaveForfeitureSettings,
} from "@/src/modules/hr/lib/leave-forfeiture-settings";

describe("parseLeaveForfeitureSettings", () => {
  it("returns defaults for empty input", () => {
    expect(parseLeaveForfeitureSettings(null)).toEqual(
      DEFAULT_LEAVE_FORFEITURE_SETTINGS,
    );
  });

  it("parses recipient toggles and role codes", () => {
    expect(
      parseLeaveForfeitureSettings({
        notifyEmployee: false,
        notifySupervisor: true,
        notifyHrRoleCodes: ["hr_administrator", "PAYROLL_ADMIN"],
        notifyLeaveManagers: false,
      }),
    ).toEqual({
      notifyEmployee: false,
      notifySupervisor: true,
      notifyHrRoleCodes: ["HR_ADMINISTRATOR", "PAYROLL_ADMIN"],
      notifyLeaveManagers: false,
      sendEmailAlerts: true,
    });
  });
});
