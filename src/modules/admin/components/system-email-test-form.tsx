"use client"

import { useActionState, useEffect } from "react"
import { Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  sendSystemTestEmail,
  type SystemEmailActionState,
} from "@/src/modules/admin/actions/manage-system-email"

const initialState: SystemEmailActionState = {
  status: "idle",
  message: "",
}

export function SystemEmailTestForm() {
  const [state, action, pending] = useActionState(
    sendSystemTestEmail,
    initialState,
  )

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message)
    }

    if (state.status === "error") {
      toast.error(state.message)
    }
  }, [state])

  return (
    <form
      action={action}
      className="flex flex-col gap-3 md:flex-row"
    >
      <Input
        name="recipientEmail"
        type="email"
        placeholder="test-recipient@company.com"
        required
      />

      <Button type="submit" disabled={pending}>
        <Send />
        {pending ? "Testing…" : "Send test email"}
      </Button>
    </form>
  )
}
