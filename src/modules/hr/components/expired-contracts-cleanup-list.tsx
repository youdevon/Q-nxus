"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  deleteExpiredEmploymentContracts,
  type DeleteEmploymentContractState,
} from "@/src/modules/hr/actions/delete-employment-contract";
import { DeleteEmploymentContractButton } from "@/src/modules/hr/components/delete-employment-contract-button";
import { contractExpiryBadgeVariant } from "@/src/config/ui-colors";

const initialState: DeleteEmploymentContractState = {
  status: "idle",
  message: "",
};

export type ExpiredContractCleanupRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  contractNumber: string | null;
  positionTitle: string;
  endDateLabel: string;
  expiryLabel: string;
  expiryCategory:
    | "EXPIRED"
    | "WITHIN_30_DAYS"
    | "WITHIN_60_DAYS"
    | "WITHIN_90_DAYS"
    | "LATER"
    | "NO_END_DATE";
  statusLabel: string;
  isCurrent: boolean;
};

export function ExpiredContractsCleanupList({
  contracts,
  canManage,
  redirectTo,
}: {
  contracts: ExpiredContractCleanupRow[];
  canManage: boolean;
  redirectTo: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(contracts.map((contract) => contract.id)),
  );
  const [state, action, pending] = useActionState(
    deleteExpiredEmploymentContracts,
    initialState,
  );

  const allSelected = useMemo(
    () =>
      contracts.length > 0 && contracts.every((contract) => selected.has(contract.id)),
    [contracts, selected],
  );

  useEffect(() => {
    setSelected(new Set(contracts.map((contract) => contract.id)));
  }, [contracts]);

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }
    if (state.status === "success") {
      toast.success(state.message);
    }
  }, [state]);

  if (contracts.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No expired contracts match this filter.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <form
          action={action}
          className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"
          onSubmit={(event) => {
            if (selected.size === 0) {
              event.preventDefault();
              toast.error("Select at least one expired contract to delete.");
              return;
            }

            const confirmed = window.confirm(
              `Permanently delete ${selected.size} selected expired contract${selected.size === 1 ? "" : "s"}?\n\nLater expired amendments/renewals in each chain are included automatically. Current live contracts are kept. Related leave data for removed contracts is deleted. Payslips are kept. This cannot be undone.`,
            );

            if (!confirmed) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="confirmed" value="on" />
          {Array.from(selected).map((id) => (
            <input key={id} type="hidden" name="contractId" value={id} />
          ))}

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => {
                  if (event.target.checked) {
                    setSelected(new Set(contracts.map((contract) => contract.id)));
                  } else {
                    setSelected(new Set());
                  }
                }}
              />
              <span>
                {selected.size} of {contracts.length} selected
              </span>
            </label>
            <p className="text-muted-foreground">
              Sample and historical expired terms can be removed here.
            </p>
          </div>

          <Button type="submit" variant="destructive" disabled={pending || selected.size === 0}>
            <Trash2 />
            {pending ? "Deleting…" : `Delete selected (${selected.size})`}
          </Button>
        </form>
      ) : null}

      <div className="divide-y divide-border/70">
        {contracts.map((contract) => (
          <div
            key={contract.id}
            className="grid gap-4 py-5 lg:grid-cols-[auto_1.3fr_1fr_10rem_10rem_11rem]"
          >
            {canManage ? (
              <div className="flex items-start pt-1">
                <input
                  type="checkbox"
                  checked={selected.has(contract.id)}
                  aria-label={`Select ${contract.employeeName}`}
                  onChange={(event) => {
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) {
                        next.add(contract.id);
                      } else {
                        next.delete(contract.id);
                      }
                      return next;
                    });
                  }}
                />
              </div>
            ) : (
              <div />
            )}

            <a
              href={`/people/employees/${contract.employeeId}/contracts/${contract.id}`}
              className="min-w-0 hover:underline"
            >
              <p className="font-medium">{contract.employeeName}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {contract.employeeNumber}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {contract.positionTitle}
              </p>
            </a>

            <div>
              <p className="text-xs text-muted-foreground">Contract</p>
              <p className="mt-1 text-sm font-medium">
                {contract.contractNumber ?? "No contract number"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {contract.statusLabel}
                {contract.isCurrent ? " · Current" : ""}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">End date</p>
              <p className="mt-1 text-sm font-medium">{contract.endDateLabel}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Expiry</p>
              <div className="mt-1">
                <Badge variant={contractExpiryBadgeVariant(contract.expiryCategory)}>
                  {contract.expiryLabel}
                </Badge>
              </div>
            </div>

            <div className="flex items-start justify-end">
              {canManage ? (
                <DeleteEmploymentContractButton
                  employeeId={contract.employeeId}
                  contractId={contract.id}
                  cleanupEligible
                  redirectTo={redirectTo}
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
