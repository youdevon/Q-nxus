"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createOrganizationHoliday,
  deactivateOrganizationHoliday,
  type OrganizationHolidayFormState,
} from "@/src/modules/hr/actions/manage-organization-holiday";
import type { OrganizationHolidayRecord } from "@/src/modules/hr/data/get-organization-holidays";

const createInitial: OrganizationHolidayFormState = {
  status: "idle",
  message: "",
};

export function OrganizationHolidaysWorkspace({
  holidays,
}: {
  holidays: OrganizationHolidayRecord[];
}) {
  const [createState, createAction, createPending] = useActionState(
    createOrganizationHoliday,
    createInitial,
  );
  const [deactivateState, deactivateAction, deactivatePending] = useActionState(
    deactivateOrganizationHoliday,
    createInitial,
  );

  useEffect(() => {
    if (createState.status === "error") {
      toast.error(createState.message);
    }
    if (createState.status === "success") {
      toast.success(createState.message);
    }
  }, [createState]);

  useEffect(() => {
    if (deactivateState.status === "error") {
      toast.error(deactivateState.message);
    }
    if (deactivateState.status === "success") {
      toast.success(deactivateState.message);
    }
  }, [deactivateState]);

  return (
    <div className="space-y-8">
      <form
        action={createAction}
        className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto]"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="name">
            Holiday name
          </label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="holidayDate">
            Date
          </label>
          <Input id="holidayDate" name="holidayDate" type="date" required />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="isRecurring"
            className="size-4 rounded border-border"
          />
          Recurring yearly
        </label>
        <div className="flex items-end">
          <Button type="submit" disabled={createPending}>
            {createPending ? "Adding…" : "Add holiday"}
          </Button>
        </div>
      </form>

      <section>
        {holidays.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No organization holidays configured. Weekends are still excluded
            from leave day counts.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {holidays.map((holiday) => (
              <div
                key={holiday.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <p className="font-medium">{holiday.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {holiday.holidayDate}
                    {holiday.isRecurring ? " · recurring yearly" : ""}
                  </p>
                </div>
                <form action={deactivateAction}>
                  <input type="hidden" name="id" value={holiday.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={deactivatePending}
                  >
                    Deactivate
                  </Button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
