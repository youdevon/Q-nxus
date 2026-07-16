"use client"

import { useActionState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { LogIn } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { appConfig } from "@/src/config/app.config"
import {
  login,
  type LoginFormState,
} from "@/src/modules/auth/actions/login"

const initialState: LoginFormState = {
  status: "idle",
  message: "",
}

export function LoginForm() {
  const searchParams = useSearchParams()
  const nextPath = searchParams.get("next") ?? "/"
  const [state, action, pending] = useActionState(
    login,
    initialState,
  )

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message)
    }
  }, [state])

  return (
    <form
      action={action}
      className="mx-auto flex w-full max-w-md flex-col gap-6"
    >
      <input type="hidden" name="next" value={nextPath} />

      <div className="space-y-2 text-center">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          {appConfig.shortName}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {appConfig.displayName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to continue to your workspace.
        </p>
      </div>

      {state.status === "error" && (
        <div className="border-y border-destructive/40 bg-destructive/5 py-3 text-center text-sm text-destructive">
          {state.message}
        </div>
      )}

      <div className="space-y-4 border-y border-border py-6">
        <div>
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            className="mt-2"
            defaultValue="admin@q-nxus.local"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="text-sm font-medium"
          >
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-2"
          />
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        <LogIn />
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
