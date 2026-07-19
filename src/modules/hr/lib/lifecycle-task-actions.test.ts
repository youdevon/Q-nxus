import { describe, expect, it } from "vitest";

import {
  resolveOffboardingTaskAction,
  resolveOnboardingTaskAction,
} from "@/src/modules/hr/lib/lifecycle-task-actions";

describe("lifecycle task actions", () => {
  it("routes draft contract and activate to the right places", () => {
    expect(resolveOnboardingTaskAction("CREATE_DRAFT_CONTRACT", "e1")).toEqual({
      label: "Create draft contract",
      href: "/people/employees/e1/contracts/new",
    });

    expect(
      resolveOnboardingTaskAction("ACTIVATE_CONTRACT", "e1", {
        activatableContractId: "c9",
      }),
    ).toEqual({
      label: "Open contract to activate",
      href: "/people/employees/e1/contracts/c9",
    });
  });

  it("routes offboarding close to close page when current contract known", () => {
    expect(
      resolveOffboardingTaskAction("CLOSE_CONTRACT", "e1", {
        currentContractId: "c2",
      }),
    ).toEqual({
      label: "Close contract",
      href: "/people/employees/e1/contracts/c2/close",
    });
  });
});
