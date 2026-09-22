import { describe, expect, it } from "vitest";

import {
  computeNachaCheckDigit,
  isValidNachaCheckDigit,
  validateFcbTtAchRouting,
} from "@/src/modules/payroll/lib/ach/ach-routing";
import { achParticipantRegistryFromSeedRoutings } from "@/src/modules/payroll/lib/ach/ach-participant-types";

describe("NACHA 3-7-1 check digit", () => {
  it("validates known TT commercial bank routings", () => {
    for (const routing of [
      "010100013",
      "010100026",
      "010100039",
      "010100903",
      "010100602",
      "010100505",
      "010100055",
      "010100107",
    ]) {
      expect(isValidNachaCheckDigit(routing)).toBe(true);
      expect(computeNachaCheckDigit(routing.slice(0, 8))).toBe(
        Number(routing[8]),
      );
    }
  });

  it("rejects a bad check digit", () => {
    expect(isValidNachaCheckDigit("010100014")).toBe(false);
  });
});

describe("validateFcbTtAchRouting with registry", () => {
  const registry = achParticipantRegistryFromSeedRoutings([
    {
      id: "fcb",
      name: "First Citizens",
      shortName: "FCB",
      routing: "010100013",
    },
  ]);

  it("accepts enabled participants", () => {
    const result = validateFcbTtAchRouting("010100013", registry);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.participant.shortName).toBe("FCB");
    }
  });

  it("rejects structurally valid but unregistered banks", () => {
    const result = validateFcbTtAchRouting("010100026", registry);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/ACH banks/);
    }
  });
});
