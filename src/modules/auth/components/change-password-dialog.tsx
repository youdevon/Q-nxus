"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { KeyRound } from "lucide-react";
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
import { FieldError, FieldHint, FieldLabel } from "@/src/components/ui/field";
import {
  changePassword,
  type ChangePasswordFormState,
} from "@/src/modules/auth/actions/change-password";

const initialState: ChangePasswordFormState = {
  status: "idle",
  message: "",
};

function ChangePasswordDialogForm({ onSuccess }: { onSuccess: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useId();
  const [state, action, pending] = useActionState(changePassword, initialState);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message || "Your password has been updated.");
      formRef.current?.reset();
      onSuccess();
    }

    if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state, onSuccess]);

  return (
    <form
      ref={formRef}
      id={formId}
      action={action}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="mode" value="inplace" />

      {state.status === "error" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          {state.message}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor={`${formId}-currentPassword`}>
            Current password
          </FieldLabel>
          <Input
            id={`${formId}-currentPassword`}
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className="mt-2"
          />
          {state.fieldErrors?.currentPassword && (
            <FieldError>{state.fieldErrors.currentPassword}</FieldError>
          )}
        </div>

        <div>
          <FieldLabel htmlFor={`${formId}-newPassword`}>
            New password
          </FieldLabel>
          <Input
            id={`${formId}-newPassword`}
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="mt-2"
          />
          {state.fieldErrors?.newPassword ? (
            <FieldError>{state.fieldErrors.newPassword}</FieldError>
          ) : (
            <FieldHint>At least 8 characters.</FieldHint>
          )}
        </div>

        <div>
          <FieldLabel htmlFor={`${formId}-confirmPassword`}>
            Confirm new password
          </FieldLabel>
          <Input
            id={`${formId}-confirmPassword`}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="mt-2"
          />
          {state.fieldErrors?.confirmPassword && (
            <FieldError>{state.fieldErrors.confirmPassword}</FieldError>
          )}
        </div>
      </div>

      <DialogFooter className="-mx-6 -mb-6 mt-1">
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" form={formId} disabled={pending}>
          <KeyRound />
          {pending ? "Saving…" : "Save new password"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle className="text-lg">Change password</DialogTitle>
          <DialogDescription>
            Update the password used to sign in to your workspace.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <ChangePasswordDialogForm onSuccess={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
