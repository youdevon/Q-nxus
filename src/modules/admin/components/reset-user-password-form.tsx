"use client";

import { useActionState, useEffect, useRef } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  resetUserPassword,
  type ResetUserPasswordFormState,
} from "@/src/modules/admin/actions/reset-user-password";

const initialState: ResetUserPasswordFormState = {
  status: "idle",
  message: "",
};

export function ResetUserPasswordForm({
  userId,
  userName,
  isSelf,
}: {
  userId: string;
  userName: string;
  isSelf: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    resetUserPassword,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      formRef.current?.reset();
    }

    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  if (isSelf) {
    return (
      <section id="reset-password">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Reset password
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Use Change password in your account menu to update your own password.
        </p>
      </section>
    );
  }

  return (
    <section id="reset-password">
      <div className="mb-4 flex items-center gap-2">
        <KeyRound className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          Reset password
        </h2>
      </div>

      <form ref={formRef} action={action} className="flex flex-col gap-5">
        <input type="hidden" name="userId" value={userId} />

        <p className="text-sm text-muted-foreground">
          Set a new sign-in password for {userName}. By default they will be
          required to choose their own password on next login.
        </p>

        {state.status === "error" && state.message && (
          <p className="text-sm text-destructive">{state.message}</p>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="newPassword" className="text-sm font-medium">
              New password
            </label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="mt-2"
            />
            {state.fieldErrors?.newPassword ? (
              <p className="mt-1 text-xs text-destructive">
                {state.fieldErrors.newPassword}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                At least 8 characters.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm new password
            </label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="mt-2"
            />
            {state.fieldErrors?.confirmPassword && (
              <p className="mt-1 text-xs text-destructive">
                {state.fieldErrors.confirmPassword}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <input
            id="mustChangePassword"
            name="mustChangePassword"
            type="checkbox"
            defaultChecked
            className="mt-0.5 size-4"
          />
          <div>
            <label htmlFor="mustChangePassword" className="text-sm font-medium">
              Require password change on next login
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Recommended for administrator resets so the user sets a private
              password.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            <KeyRound />
            {pending ? "Saving…" : "Reset password"}
          </Button>
        </div>
      </form>
    </section>
  );
}
