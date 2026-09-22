"use server";

import { revalidatePath } from "next/cache";

import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { postMonthlyGratuityAccruals } from "@/src/modules/payroll/services/gratuity-accruals";

export type GratuityAccrualFormState = {
  status: "idle" | "error" | "success";
  message: string;
};

export async function runGratuityMonthlyAccrualPost(
  _previousState: GratuityAccrualFormState,
  _formData: FormData,
): Promise<GratuityAccrualFormState> {
  const actor = await requireActor("payroll.manage");

  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  try {
    const result = await postMonthlyGratuityAccruals({
      postedByUserId: actor.actor.userId,
    });

    revalidatePath("/payroll/gratuity");

    return {
      status: "success",
      message: `Accrual ${result.periodKey}: posted ${result.posted}, updated ${result.updated}, skipped ${result.skipped} (period total ${result.totalPeriodAccrual.toFixed(2)}).`,
    };
  } catch (error) {
    console.error("runGratuityMonthlyAccrualPost failed:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not post monthly gratuity accruals.",
    };
  }
}
