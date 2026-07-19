"use client";

import { useActionState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "@/src/components/ui/field";
import { UI_ELEVATION } from "@/src/config/ui-elevation";
import { UI_TYPOGRAPHY } from "@/src/config/ui-typography";
import { login, type LoginFormState } from "@/src/modules/auth/actions/login";
import { cn } from "@/lib/utils";

const initialState: LoginFormState = {
  status: "idle",
  message: "",
};

export function LoginForm({
  shortName,
  organizationName,
}: {
  shortName: string;
  organizationName: string;
}) {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/";
  const [state, action, pending] = useActionState(login, initialState);

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form
      action={action}
      className="mx-auto flex w-full max-w-md flex-col gap-6 text-foreground"
    >
      <input type="hidden" name="next" value={nextPath} />

      <div className="space-y-2 text-center">
        <p className="text-xs font-medium tracking-[0.2em] text-foreground/70 uppercase">
          {shortName}
        </p>
        <h1 className={cn(UI_TYPOGRAPHY.authHero, "text-foreground")}>
          {organizationName}
        </h1>
        <p className="text-sm text-foreground/75">
          Sign in to continue to your workspace.
        </p>
      </div>

      <div
        className={cn(
          UI_ELEVATION.authCard,
          "flex flex-col gap-5 px-6 py-7 sm:px-8 sm:py-8",
        )}
      >
        {state.status === "error" && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-center text-sm font-medium text-destructive">
            {state.message}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <FieldLabel htmlFor="email" className="text-card-foreground">
              Email
            </FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="mt-2 bg-background text-foreground"
              defaultValue="admin@q-nxus.local"
            />
          </div>

          <div>
            <FieldLabel htmlFor="password" className="text-card-foreground">
              Password
            </FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-2 bg-background text-foreground"
            />
          </div>
        </div>

        <Button type="submit" disabled={pending} className="w-full">
          <LogIn />
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </div>
    </form>
  );
}
