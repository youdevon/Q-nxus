import { describe, expect, it } from "vitest";

import {
  correctionCodeForKind,
  defaultAdjustmentLabel,
  isCorrectionAdjustmentCode,
  isSupplementalPayRunKind,
} from "@/src/modules/payroll/lib/payroll-adjustment-line";

describe("payroll adjustment line helpers", () => {
  it("recognizes correction adjustment codes", () => {
    expect(isCorrectionAdjustmentCode("CORRECTION_EARNING")).toBe(true);
    expect(isCorrectionAdjustmentCode("CORRECTION_DEDUCTION")).toBe(true);
    expect(isCorrectionAdjustmentCode("OVERTIME")).toBe(false);
  });

  it("maps adjustment kind to line codes and labels", () => {
    expect(correctionCodeForKind("EARNING")).toBe("CORRECTION_EARNING");
    expect(correctionCodeForKind("DEDUCTION")).toBe("CORRECTION_DEDUCTION");
    expect(defaultAdjustmentLabel("EARNING")).toBe("Correction earning");
    expect(defaultAdjustmentLabel("DEDUCTION")).toBe("Correction deduction");
  });

  it("identifies supplemental pay run kinds", () => {
    expect(isSupplementalPayRunKind("CORRECTION")).toBe(true);
    expect(isSupplementalPayRunKind("OFF_CYCLE")).toBe(true);
    expect(isSupplementalPayRunKind("REGULAR")).toBe(false);
  });
});
