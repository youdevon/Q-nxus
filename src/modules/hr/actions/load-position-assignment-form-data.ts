"use server";

import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  getPositionAssignmentFormData,
  type PositionAssignmentFormData,
} from "@/src/modules/hr/data/get-employee-assignments";

export async function loadPositionAssignmentFormData(
  positionId: string,
): Promise<PositionAssignmentFormData | null> {
  const actor = await requireActor("people.manage");

  if (!actor.ok) {
    return null;
  }

  return getPositionAssignmentFormData(positionId);
}
