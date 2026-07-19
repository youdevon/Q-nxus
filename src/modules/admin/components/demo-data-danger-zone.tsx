"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Building2, Trash2, Users, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  clearDepartments,
  clearEmployeesAndUsers,
  clearPayRuns,
  type ClearDemoDataFormState,
} from "@/src/modules/admin/actions/clear-demo-data";

const initialState: ClearDemoDataFormState = {
  status: "idle",
  message: "",
};

const CONFIRMATION_TOKEN = "RESET";

type ClearAction = (
  previousState: ClearDemoDataFormState,
  formData: FormData,
) => Promise<ClearDemoDataFormState>;

function ClearDemoDataDialog({
  title,
  description,
  confirmLabel,
  action,
  triggerLabel,
  triggerIcon,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  action: ClearAction;
  triggerLabel: string;
  triggerIcon: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      setOpen(false);
      setConfirmation("");
    }

    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  useEffect(() => {
    if (!open) {
      setConfirmation("");
    }
  }, [open]);

  const confirmed = confirmation === CONFIRMATION_TOKEN;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="destructive"
        onClick={() => setOpen(true)}
      >
        {triggerIcon}
        {triggerLabel}
      </Button>

      <DialogContent
        showCloseButton={!pending}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <p className="font-medium">This cannot be undone.</p>
          <p>
            Type{" "}
            <span className="font-mono font-semibold text-foreground">
              {CONFIRMATION_TOKEN}
            </span>{" "}
            to enable the confirm button.
          </p>
        </div>

        {state.status === "error" ? (
          <div
            role="alert"
            className="border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          >
            {state.message}
          </div>
        ) : null}

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor={`confirm-${triggerLabel}`}
              className="text-sm font-medium"
            >
              Confirmation
            </label>
            <Input
              id={`confirm-${triggerLabel}`}
              name="confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={CONFIRMATION_TOKEN}
              autoComplete="off"
              disabled={pending}
              aria-required
            />
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={pending} />
              }
            >
              Cancel
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              disabled={pending || !confirmed}
            >
              <Trash2 />
              {pending ? "Clearing…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DemoDataDangerZone() {
  return (
    <section className="border-t border-destructive/30 pt-8">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="size-4 text-destructive" />
        <h2 className="text-sm font-semibold tracking-wide text-destructive uppercase">
          Danger zone — Demo data
        </h2>
      </div>

      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Irreversible wipe for development and going live after a demo. Requires
        server env{" "}
        <code className="text-xs">ALLOW_DEMO_DATA_RESET=true</code> and a system
        administrator. Protected administrator accounts (including the default
        administrator at admin@q-nxus.local), roles/permissions, leave types,
        allowance categories, statutory configs, and organization identity are
        kept. Notifications for cleared users are removed. Clear employees
        before clearing departments.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="space-y-3">
          <h3 className="font-medium">Clear pay runs</h3>
          <p className="text-sm text-muted-foreground">
            Removes all pay runs, payslips, payment batches, and payroll
            periods, then resets the{" "}
            <code className="text-xs">PAY_RUN</code> numbering sequence so the
            next run starts at 1. Employees and payroll profiles are kept.
          </p>
          <ClearDemoDataDialog
            title="Clear pay runs?"
            description="Permanently deletes every pay run (including posted), payslips, ACH/payment prep data, and payroll periods for this organization, then resets the PAY_RUN counter. Employee master data and statutory settings are not removed."
            confirmLabel="Clear pay runs"
            action={clearPayRuns}
            triggerLabel="Clear pay runs"
            triggerIcon={<Wallet />}
          />
        </article>

        <article className="space-y-3">
          <h3 className="font-medium">Clear employees &amp; users</h3>
          <p className="text-sm text-muted-foreground">
            Removes employees and linked contracts, payroll profiles, pay
            runs/payslips, leave balances/requests, assignments, appraisals,
            non-administrator user accounts, and their in-app notifications. The
            default administrator account is never deleted.
          </p>
          <ClearDemoDataDialog
            title="Clear employees & users?"
            description="Permanently deletes all employees and their HR/payroll/leave data, plus user accounts that are not system administrators. Notifications for removed users are deleted. The default administrator (admin@q-nxus.local) and your SYSTEM_ADMINISTRATOR login are preserved."
            confirmLabel="Clear employees & users"
            action={clearEmployeesAndUsers}
            triggerLabel="Clear employees & users"
            triggerIcon={<Users />}
          />
        </article>

        <article className="space-y-3">
          <h3 className="font-medium">Clear departments</h3>
          <p className="text-sm text-muted-foreground">
            Removes departments, positions, reporting lines, and job
            descriptions. Fails if employees still exist — run the employee
            clear first.
          </p>
          <ClearDemoDataDialog
            title="Clear departments?"
            description="Permanently deletes all departments, positions, reporting lines, and job descriptions. Organization name/code and configuration catalogs are not removed."
            confirmLabel="Clear departments"
            action={clearDepartments}
            triggerLabel="Clear departments"
            triggerIcon={<Building2 />}
          />
        </article>
      </div>
    </section>
  );
}
