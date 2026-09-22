import { describe, expect, it } from "vitest";

import {
  evaluateVacationForfeitureAlert,
  formatVacationForfeitureMessage,
  hasForfeitableAvailableVacation,
  isWithinVacationForfeitureWindow,
  utcCalendarDaysUntil,
  VACATION_FORFEITURE_NOTICE_DAYS,
} from "@/src/modules/hr/lib/vacation-forfeiture";

describe("vacation forfeiture window", () => {
  it("counts whole UTC calendar days between dates", () => {
    expect(
      utcCalendarDaysUntil(
        new Date("2026-07-16T15:30:00.000Z"),
        new Date("2026-08-15T00:00:00.000Z"),
      ),
    ).toBe(30);

    expect(
      utcCalendarDaysUntil(
        new Date("2026-07-16T00:00:00.000Z"),
        new Date("2026-07-16T23:59:59.000Z"),
      ),
    ).toBe(0);
  });

  it(`treats ≤${VACATION_FORFEITURE_NOTICE_DAYS} days as in-window`, () => {
    expect(isWithinVacationForfeitureWindow(30)).toBe(true);
    expect(isWithinVacationForfeitureWindow(0)).toBe(true);
    expect(isWithinVacationForfeitureWindow(-3)).toBe(true);
    expect(isWithinVacationForfeitureWindow(31)).toBe(false);
  });

  it("only counts positive available vacation", () => {
    expect(hasForfeitableAvailableVacation("0")).toBe(false);
    expect(hasForfeitableAvailableVacation("0.00")).toBe(false);
    expect(hasForfeitableAvailableVacation("2.5")).toBe(true);
    expect(hasForfeitableAvailableVacation(-1)).toBe(false);
  });
});

describe("evaluateVacationForfeitureAlert", () => {
  const asOf = new Date("2026-07-16T12:00:00.000Z");

  it("returns null when there is no contract end date", () => {
    expect(
      evaluateVacationForfeitureAlert({
        availableVacation: "5",
        contractEndDate: null,
        asOf,
      }),
    ).toBeNull();
  });

  it("returns null when available vacation is zero", () => {
    expect(
      evaluateVacationForfeitureAlert({
        availableVacation: "0",
        contractEndDate: new Date("2026-08-01T00:00:00.000Z"),
        asOf,
      }),
    ).toBeNull();
  });

  it("returns null when contract end is more than 30 days away", () => {
    expect(
      evaluateVacationForfeitureAlert({
        availableVacation: "4",
        contractEndDate: new Date("2026-08-16T00:00:00.000Z"),
        asOf,
      }),
    ).toBeNull();
  });

  it("fires at the 30-day mark with available vacation", () => {
    const alert = evaluateVacationForfeitureAlert({
      availableVacation: "3.5",
      contractEndDate: new Date("2026-08-15T00:00:00.000Z"),
      asOf,
    });

    expect(alert).toEqual({
      daysUntilEnd: 30,
      availableDays: 3.5,
      contractEndDateIso: "2026-08-15",
      isUrgent: false,
    });
  });

  it("fires when fewer than 30 days remain", () => {
    const alert = evaluateVacationForfeitureAlert({
      availableVacation: "2",
      contractEndDate: new Date("2026-07-20T00:00:00.000Z"),
      asOf,
    });

    expect(alert?.daysUntilEnd).toBe(4);
    expect(alert?.isUrgent).toBe(false);
  });

  it("marks today and past end dates as urgent", () => {
    expect(
      evaluateVacationForfeitureAlert({
        availableVacation: "1",
        contractEndDate: new Date("2026-07-16T00:00:00.000Z"),
        asOf,
      })?.isUrgent,
    ).toBe(true);

    expect(
      evaluateVacationForfeitureAlert({
        availableVacation: "1",
        contractEndDate: new Date("2026-07-10T00:00:00.000Z"),
        asOf,
      })?.isUrgent,
    ).toBe(true);
  });

  it("frames copy around finishing leave by contract end", () => {
    const alert = evaluateVacationForfeitureAlert({
      availableVacation: "2",
      contractEndDate: new Date("2026-08-01T00:00:00.000Z"),
      asOf,
    });

    expect(alert).not.toBeNull();
    const message = formatVacationForfeitureMessage(alert!);
    expect(message).toMatch(/cannot roll over/i);
    expect(message).toMatch(/on or before the contract end date/i);
    expect(message).toContain("2026-08-01");
  });

  it("uses third-person contract wording for authority alerts", () => {
    const alert = evaluateVacationForfeitureAlert({
      availableVacation: "7",
      contractEndDate: new Date("2026-08-03T00:00:00.000Z"),
      asOf,
    });

    expect(alert).not.toBeNull();
    const message = formatVacationForfeitureMessage(alert!, {
      employeeName: "Jaden Baird",
    });
    expect(message).toContain("Jaden Baird still has 7 day(s)");
    expect(message).toContain("Their contract ends on 2026-08-03");
    expect(message).not.toContain("Your contract ends");
  });
});
