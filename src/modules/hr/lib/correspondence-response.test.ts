import { describe, expect, it } from "vitest";

import {
  canEmployeeSubmitCorrespondenceResponse,
  canEmployeeUpdateCorrespondenceResponse,
  canHrReviewCorrespondenceResponse,
  canTransitionCorrespondenceResponseStatus,
  defaultAllowsEmployeeResponse,
} from "@/src/modules/hr/lib/correspondence-response";

describe("defaultAllowsEmployeeResponse", () => {
  it("enables disciplinary, warning, and performance letters by default", () => {
    expect(defaultAllowsEmployeeResponse("DISCIPLINARY")).toBe(true);
    expect(defaultAllowsEmployeeResponse("WARNING")).toBe(true);
    expect(defaultAllowsEmployeeResponse("PERFORMANCE")).toBe(true);
  });

  it("does not enable routine letter categories by default", () => {
    expect(defaultAllowsEmployeeResponse("GENERAL")).toBe(false);
    expect(defaultAllowsEmployeeResponse("OFFER_LETTER")).toBe(false);
    expect(defaultAllowsEmployeeResponse("RECOMMENDATION")).toBe(false);
    expect(defaultAllowsEmployeeResponse("COMMENDATION")).toBe(false);
  });
});

describe("canEmployeeSubmitCorrespondenceResponse", () => {
  const eligibleLetter = {
    status: "ISSUED" as const,
    employeeVisible: true,
    allowsEmployeeResponse: true,
  };

  it("allows first submission on eligible issued letters", () => {
    expect(
      canEmployeeSubmitCorrespondenceResponse(eligibleLetter, null),
    ).toBe(true);
  });

  it("allows updates while the response is open", () => {
    expect(
      canEmployeeSubmitCorrespondenceResponse(eligibleLetter, {
        status: "OPEN",
      }),
    ).toBe(true);
  });

  it("blocks submission when response is already reviewed", () => {
    expect(
      canEmployeeSubmitCorrespondenceResponse(eligibleLetter, {
        status: "REVIEWED",
      }),
    ).toBe(false);
  });

  it("blocks submission when the letter does not allow responses", () => {
    expect(
      canEmployeeSubmitCorrespondenceResponse(
        { ...eligibleLetter, allowsEmployeeResponse: false },
        null,
      ),
    ).toBe(false);
  });

  it("blocks submission on drafts and archived letters", () => {
    expect(
      canEmployeeSubmitCorrespondenceResponse(
        { ...eligibleLetter, status: "DRAFT" },
        null,
      ),
    ).toBe(false);
    expect(
      canEmployeeSubmitCorrespondenceResponse(
        { ...eligibleLetter, status: "ARCHIVED" },
        null,
      ),
    ).toBe(false);
  });
});

describe("canEmployeeUpdateCorrespondenceResponse", () => {
  it("only permits updates while open", () => {
    expect(
      canEmployeeUpdateCorrespondenceResponse({ status: "OPEN" }),
    ).toBe(true);
    expect(
      canEmployeeUpdateCorrespondenceResponse({ status: "REVIEWED" }),
    ).toBe(false);
    expect(canEmployeeUpdateCorrespondenceResponse(null)).toBe(false);
  });
});

describe("canHrReviewCorrespondenceResponse", () => {
  it("only permits review while open", () => {
    expect(canHrReviewCorrespondenceResponse({ status: "OPEN" })).toBe(true);
    expect(canHrReviewCorrespondenceResponse({ status: "REVIEWED" })).toBe(
      false,
    );
    expect(canHrReviewCorrespondenceResponse(null)).toBe(false);
  });
});

describe("canTransitionCorrespondenceResponseStatus", () => {
  it("allows OPEN to REVIEWED only", () => {
    expect(canTransitionCorrespondenceResponseStatus("OPEN", "REVIEWED")).toBe(
      true,
    );
    expect(canTransitionCorrespondenceResponseStatus("REVIEWED", "OPEN")).toBe(
      false,
    );
    expect(canTransitionCorrespondenceResponseStatus("OPEN", "OPEN")).toBe(
      false,
    );
  });
});
