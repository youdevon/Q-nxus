"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"
import {
  ArrowLeft,
  Save,
  WalletCards,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/src/components/layout/page-header"
import {
  createAllowanceCategory,
  updateAllowanceCategory,
  type AllowanceCategoryFormState,
} from "@/src/modules/admin/actions/manage-allowance-category"
import type { AllowanceCategoryAdminRecord } from "@/src/modules/admin/data/get-allowance-categories"
import { AdministrationNav } from "./administration-nav"

const initialState: AllowanceCategoryFormState = {
  status: "idle",
  message: "",
}

export function AllowanceCategoryForm({
  category,
}: {
  category?: AllowanceCategoryAdminRecord | null
}) {
  const action = category
    ? updateAllowanceCategory
    : createAllowanceCategory

  const [state, formAction, pending] = useActionState(
    action,
    initialState,
  )

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message)
    }

    if (state.status === "conflict") {
      toast.warning(state.message)
    }
  }, [state])

  return (
    <form
      action={formAction}
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8"
    >
      <AdministrationNav />

      {category && (
        <>
          <input
            type="hidden"
            name="id"
            value={category.id}
          />
          <input
            type="hidden"
            name="updatedAt"
            value={category.updatedAt}
          />
        </>
      )}

      <PageHeader
        title={
          category
            ? "Edit Allowance Category"
            : "New Allowance Category"
        }
        description="Configure allowance defaults used during employment contract entry."
        actions={
          <div className="flex gap-2">
            <Button
              nativeButton={false}
              variant="outline"
              render={
                <Link
                  href={
                    category
                      ? `/administration/allowances/${category.id}`
                      : "/administration/allowances"
                  }
                />
              }
            >
              <ArrowLeft />
              Cancel
            </Button>

            <Button type="submit" disabled={pending}>
              <Save />
              {pending ? "Saving…" : "Save category"}
            </Button>
          </div>
        }
      />

      {state.status !== "idle" && (
        <div
          role="alert"
          className="border-y border-destructive/40 bg-destructive/5 py-3 text-sm text-destructive"
        >
          {state.message}
        </div>
      )}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <WalletCards className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Category details
          </h2>
        </div>

        <div className="grid gap-5 border-y border-border py-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="name"
              className="text-sm font-medium"
            >
              Category name
            </label>
            <Input
              id="name"
              name="name"
              defaultValue={category?.name ?? ""}
              className="mt-2"
              required
            />
          </div>

          <div>
            <label
              htmlFor="code"
              className="text-sm font-medium"
            >
              Code
            </label>
            <Input
              id="code"
              name="code"
              maxLength={20}
              defaultValue={category?.code ?? ""}
              className="mt-2 font-mono uppercase"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="description"
              className="text-sm font-medium"
            >
              Description
            </label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={category?.description ?? ""}
              className="mt-2"
            />
          </div>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="isTaxableDefault"
              defaultChecked={
                category?.isTaxableDefault ?? true
              }
              className="mt-0.5 size-4"
            />
            <span>
              <span className="block text-sm font-medium">
                Taxable by default
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                New contract allowance lines will inherit this
                setting.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="includedInGratuityDefault"
              defaultChecked={
                category?.includedInGratuityDefault ??
                false
              }
              className="mt-0.5 size-4"
            />
            <span>
              <span className="block text-sm font-medium">
                Include in gratuity by default
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Include this allowance when estimating
                gratuity-eligible earnings.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 md:col-span-2">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={category?.isActive ?? true}
              className="mt-0.5 size-4"
            />
            <span>
              <span className="block text-sm font-medium">
                Category is active
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Inactive categories remain on historical
                contracts but cannot be selected for new ones.
              </span>
            </span>
          </label>
        </div>
      </section>
    </form>
  )
}
