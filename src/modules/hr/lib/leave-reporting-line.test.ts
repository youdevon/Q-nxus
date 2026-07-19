import { describe, expect, it } from "vitest";

import {
  allAcknowledgementsComplete,
  canAcknowledgeLeaveRequest,
  canFinalApproverAct,
  resolveAcknowledgementChain,
  walkReportingLineAncestors,
  type ReportingLineHolder,
  type ReportingLinePosition,
} from "@/src/modules/hr/lib/leave-reporting-line";

function positions(
  rows: Array<[string, string, string | null]>,
): Map<string, ReportingLinePosition> {
  return new Map(
    rows.map(([id, title, reportsToPositionId]) => [
      id,
      { id, title, reportsToPositionId },
    ]),
  );
}

function holders(
  rows: Array<[string, string, string, string | null]>,
): Map<string, ReportingLineHolder> {
  return new Map(
    rows.map(([positionId, employeeId, employeeName, userId]) => [
      positionId,
      {
        positionId,
        employeeId,
        employeeName,
        userId,
        userEmail: userId ? `${userId}@example.com` : null,
        userName: employeeName,
      },
    ]),
  );
}

describe("walkReportingLineAncestors", () => {
  it("walks up to and including the stop position", () => {
    const map = positions([
      ["clerk", "Clerk", "supervisor"],
      ["supervisor", "Supervisor", "director"],
      ["director", "Director", "gm"],
      ["gm", "General Manager", null],
    ]);

    expect(
      walkReportingLineAncestors({
        startPositionId: "clerk",
        positionsById: map,
        stopPositionId: "gm",
      }).map((item) => item.id),
    ).toEqual(["supervisor", "director", "gm"]);
  });

  it("guards cycles", () => {
    const map = positions([
      ["a", "A", "b"],
      ["b", "B", "a"],
    ]);

    expect(
      walkReportingLineAncestors({
        startPositionId: "a",
        positionsById: map,
      }).map((item) => item.id),
    ).toEqual(["b"]);
  });
});

describe("resolveAcknowledgementChain", () => {
  const map = positions([
    ["clerk", "Clerk", "supervisor"],
    ["supervisor", "Supervisor", "director"],
    ["director", "Director", "gm"],
    ["gm", "General Manager", null],
  ]);

  it("returns intermediate holders excluding the final approver", () => {
    const result = resolveAcknowledgementChain({
      requesterPositionId: "clerk",
      finalApproverPositionId: "gm",
      positionsById: map,
      holdersByPositionId: holders([
        ["supervisor", "e1", "Sue Supervisor", "u1"],
        ["director", "e2", "Dan Director", "u2"],
        ["gm", "e3", "Gina GM", "u3"],
      ]),
    });

    expect(result.reachedFinalApprover).toBe(true);
    expect(result.issue).toBeNull();
    expect(result.chain.map((node) => node.positionId)).toEqual([
      "supervisor",
      "director",
    ]);
    expect(result.chain.map((node) => node.sequenceNumber)).toEqual([1, 2]);
    expect(result.chain[0]?.userId).toBe("u1");
  });

  it("returns empty chain when requester reports directly to final", () => {
    const result = resolveAcknowledgementChain({
      requesterPositionId: "director",
      finalApproverPositionId: "gm",
      positionsById: map,
      holdersByPositionId: holders([["gm", "e3", "Gina GM", "u3"]]),
    });

    expect(result.chain).toEqual([]);
    expect(result.issue).toBe("EMPTY_CHAIN_OK");
  });

  it("flags when final approver is not in the reporting line", () => {
    const result = resolveAcknowledgementChain({
      requesterPositionId: "clerk",
      finalApproverPositionId: "other",
      positionsById: map,
      holdersByPositionId: new Map(),
    });

    expect(result.reachedFinalApprover).toBe(false);
    expect(result.issue).toBe("FINAL_NOT_IN_LINE");
  });
});

describe("canAcknowledgeLeaveRequest", () => {
  const acknowledgements = [
    {
      sequenceNumber: 1,
      status: "PENDING",
      acknowledgerUserId: "u1",
    },
    {
      sequenceNumber: 2,
      status: "PENDING",
      acknowledgerUserId: "u2",
    },
  ];

  it("allows any assigned user when ackOrder is ANY", () => {
    expect(
      canAcknowledgeLeaveRequest({
        acknowledgements,
        actorUserId: "u2",
        ackOrder: "ANY",
        canManageLeave: false,
      }),
    ).toEqual({ ok: true, targetSequence: 2 });
  });

  it("enforces sequence when ackOrder is SEQUENTIAL", () => {
    expect(
      canAcknowledgeLeaveRequest({
        acknowledgements,
        actorUserId: "u2",
        ackOrder: "SEQUENTIAL",
        canManageLeave: false,
      }).ok,
    ).toBe(false);

    expect(
      canAcknowledgeLeaveRequest({
        acknowledgements,
        actorUserId: "u1",
        ackOrder: "SEQUENTIAL",
        canManageLeave: false,
      }),
    ).toEqual({ ok: true, targetSequence: 1 });
  });
});

describe("canFinalApproverAct / allAcknowledgementsComplete", () => {
  it("blocks final until all acks when required", () => {
    expect(
      canFinalApproverAct({
        requireAllAcksBeforeFinal: true,
        acknowledgements: [
          { status: "ACKNOWLEDGED" },
          { status: "PENDING" },
        ],
      }),
    ).toBe(false);

    expect(
      canFinalApproverAct({
        requireAllAcksBeforeFinal: true,
        acknowledgements: [
          { status: "ACKNOWLEDGED" },
          { status: "ACKNOWLEDGED" },
        ],
      }),
    ).toBe(true);
  });

  it("treats empty acknowledgement lists as complete", () => {
    expect(allAcknowledgementsComplete([])).toBe(true);
    expect(
      canFinalApproverAct({
        requireAllAcksBeforeFinal: true,
        acknowledgements: [],
      }),
    ).toBe(true);
  });
});
