"use client"

import { useActionState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { KeyRound } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { appConfig } from "@/src/config/app.config"
import {
  changePassword,
  type ChangePasswordFormState,
} from "@/src/modules/auth/actions/change-password"
import { logout } from "@/src/modules/auth/actions/login"

const initialState: ChangePasswordFormState = {
  status: "idle",
  message: "",
}

export function ChangePasswordForm({
  forced = false,
}: {
  forced?: boolean
}) {
  const searchParams = useSearchParams()
  const nextPath = searchParams.get("next") ?? "/"
  const [state, action, pending] = useActionState(
    changePassword,
    initialState,
  )

  useEffect(() => {
    if (state.status === "error" && state.message) {
      toast.error(state.message)
    }
  }, [state])

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <form action={action} className="flex flex-col gap-6">
        <input type="hidden" name="next" value={nextPath} />

        <div className="space-y-2 text-center">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            {appConfig.shortName}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {forced ? "Set a new password" : "Change password"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {forced
              ? "Your account was issued a temporary password. Choose a new one before continuing."
              : "Update the password used to sign in to your workspace."}
          </p>
        </div>

        {state.status === "error" && (
          <div className="border-y border-destructive/40 bg-destructive/5 py-3 text-center text-sm text-destructive">
            {state.message}
          </div>
        )}

        <div className="space-y-4 border-y border-border py-6">
          <div>
            <label
              htmlFor="currentPassword"
              className="text-sm font-medium"
            >
              Current password
            </label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              className="mt-2"
            />
            {state.fieldErrors?.currentPassword && (
              <p className="mt-2 text-xs text-destructive">
                {state.fieldErrors.currentPassword}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="text-sm font-medium"
            >
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
              <p className="mt-2 text-xs text-destructive">
                {state.fieldErrors.newPassword}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                At least 8 characters.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium"
            >
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
              <p className="mt-2 text-xs text-destructive">
                {state.fieldErrors.confirmPassword}
              </p>
            )}
          </div>
        </div>

        <Button type="submit" disabled={pending} className="w-full">
          <KeyRound />
          {pending ? "Saving…" : "Save new password"}
        </Button>
      </form>

      {forced && (
        <form action={logout} className="text-center">
          <Button
            type="submit"
            variant="ghost"
            className="text-muted-foreground"
          >
            Sign out
          </Button>
        </form>
      )}
    </div>
  )
}
