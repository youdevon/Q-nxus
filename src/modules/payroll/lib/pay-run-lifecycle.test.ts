import { describe, expect, it } from "vitest";

import {
  canApprovePayRun,
  canClosePayRun,
  canDeletePayRun,
  canPostPayRun,
  canRecalculatePayRun,
  canReconcilePayRun,
  isPayRunClosed,
  isPayRunEditable,
  isPayRunMutable,
  isPayRunPosted,
  payRunStatusLabel,
  PAY_RUN_STATUSES,
} from "./pay-run-lifecycle";

describe("pay-run lifecycle helpers", () => {
  it("isPayRunMutable is true for DRAFT and APPROVED (open, not frozen)", () => {
    expect(isPayRunMutable("DRAFT")).toBe(true);
    expect(isPayRunMutable("APPROVED")).toBe(true);
    expect(isPayRunMutable("POSTED")).toBe(false);
    expect(isPayRunMutable("RECONCILED")).toBe(false);
    expect(isPayRunMutable("CLOSED")).toBe(false);
  });

  it("isPayRunEditable is true only for DRAFT", () => {
    expect(isPayRunEditable("DRAFT")).toBe(true);
    expect(isPayRunEditable("APPROVED")).toBe(false);
    expect(isPayRunEditable("POSTED")).toBe(false);
    expect(isPayRunEditable("RECONCILED")).toBe(false);
    expect(isPayRunEditable("CLOSED")).toBe(false);
  });

  it("isPayRunPosted covers POSTED, RECONCILED, and CLOSED", () => {
    expect(isPayRunPosted("DRAFT")).toBe(false);
    expect(isPayRunPosted("APPROVED")).toBe(false);
    expect(isPayRunPosted("POSTED")).toBe(true);
    expect(isPayRunPosted("RECONCILED")).toBe(true);
    expect(isPayRunPosted("CLOSED")).toBe(true);
  });

  it("isPayRunClosed is true only for CLOSED", () => {
    expect(isPayRunClosed("CLOSED")).toBe(true);
    expect(isPayRunClosed("RECONCILED")).toBe(false);
    expect(isPayRunClosed("POSTED")).toBe(false);
  });

  it("canApprovePayRun only allows DRAFT", () => {
    expect(canApprovePayRun("DRAFT")).toBe(true);
    expect(canApprovePayRun("APPROVED")).toBe(false);
    expect(canApprovePayRun("POSTED")).toBe(false);
  });

  it("canRecalculatePayRun allows DRAFT and APPROVED", () => {
    expect(canRecalculatePayRun("DRAFT")).toBe(true);
    expect(canRecalculatePayRun("APPROVED")).toBe(true);
    expect(canRecalculatePayRun("POSTED")).toBe(false);
  });

  it("canPostPayRun requires APPROVED", () => {
    expect(canPostPayRun("APPROVED")).toBe(true);
    expect(canPostPayRun("DRAFT")).toBe(false);
    expect(canPostPayRun("POSTED")).toBe(false);
    expect(canPostPayRun("RECONCILED")).toBe(false);
    expect(canPostPayRun("CLOSED")).toBe(false);
  });

  it("canDeletePayRun allows every lifecycle status (test wipe)", () => {
    expect(canDeletePayRun("DRAFT")).toBe(true);
    expect(canDeletePayRun("APPROVED")).toBe(true);
    expect(canDeletePayRun("POSTED")).toBe(true);
    expect(canDeletePayRun("RECONCILED")).toBe(true);
    expect(canDeletePayRun("CLOSED")).toBe(true);
    expect(canDeletePayRun("UNKNOWN")).toBe(false);
  });

  it("canReconcilePayRun only allows POSTED", () => {
    expect(canReconcilePayRun("POSTED")).toBe(true);
    expect(canReconcilePayRun("DRAFT")).toBe(false);
    expect(canReconcilePayRun("APPROVED")).toBe(false);
    expect(canReconcilePayRun("RECONCILED")).toBe(false);
    expect(canReconcilePayRun("CLOSED")).toBe(false);
  });

  it("canClosePayRun allows POSTED and RECONCILED", () => {
    expect(canClosePayRun("POSTED")).toBe(true);
    expect(canClosePayRun("RECONCILED")).toBe(true);
    expect(canClosePayRun("DRAFT")).toBe(false);
    expect(canClosePayRun("APPROVED")).toBe(false);
    expect(canClosePayRun("CLOSED")).toBe(false);
  });

  it("payRunStatusLabel produces a human label for every known status", () => {
    for (const status of PAY_RUN_STATUSES) {
      expect(payRunStatusLabel(status)).not.toBe(status);
    }
    expect(payRunStatusLabel("UNKNOWN")).toBe("UNKNOWN");
  });

  it("the lifecycle forms a strictly ordered chain with no overlap gaps", () => {
    // DRAFT -> APPROVED -> POSTED -> RECONCILED -> CLOSED
    expect(canApprovePayRun("DRAFT")).toBe(true);
    expect(canPostPayRun("APPROVED")).toBe(true);
    expect(canReconcilePayRun("POSTED")).toBe(true);
    expect(canClosePayRun("RECONCILED")).toBe(true);
    expect(isPayRunClosed("CLOSED")).toBe(true);
  });
});
