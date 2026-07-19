"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  deleteRole,
  duplicateRoleAsCustom,
  type DeleteRoleState,
  type DuplicateRoleState,
} from "@/src/modules/admin/actions/save-role";

const idleDelete: DeleteRoleState = {
  status: "idle",
  message: "",
};

const idleDuplicate: DuplicateRoleState = {
  status: "idle",
  message: "",
};

type RoleActionsProps = {
  roleId: string;
  roleName: string;
  isSystem: boolean;
  assignmentCount: number;
};

export function RoleActions({
  roleId,
  roleName,
  isSystem,
  assignmentCount,
}: RoleActionsProps) {
  const router = useRouter();
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteRole,
    idleDelete,
  );
  const [duplicateState, duplicateAction, duplicatePending] = useActionState(
    duplicateRoleAsCustom,
    idleDuplicate,
  );

  useEffect(() => {
    if (deleteState.status === "success") {
      toast.success(deleteState.message);

      if (deleteState.redirectTo) {
        router.push(deleteState.redirectTo);
        router.refresh();
      }
    }

    if (deleteState.status === "error") {
      toast.error(deleteState.message);
    }
  }, [deleteState, router]);

  useEffect(() => {
    if (duplicateState.status === "success") {
      toast.success(duplicateState.message);

      if (duplicateState.redirectTo) {
        router.push(duplicateState.redirectTo);
        router.refresh();
      }
    }

    if (duplicateState.status === "error") {
      toast.error(duplicateState.message);
    }
  }, [duplicateState, router]);

  return (
    <div className="flex flex-wrap gap-2">
      <form action={duplicateAction}>
        <input type="hidden" name="sourceId" value={roleId} />
        <Button
          type="submit"
          variant="outline"
          disabled={duplicatePending}
        >
          <Copy />
          {duplicatePending ? "Duplicating…" : "Duplicate as custom role"}
        </Button>
      </form>

      {!isSystem && (
        <form
          action={deleteAction}
          onSubmit={(event) => {
            if (assignmentCount > 0) {
              event.preventDefault();
              toast.error(
                `Revoke ${assignmentCount} active assignment${assignmentCount === 1 ? "" : "s"} before deleting.`,
              );
              return;
            }

            const confirmed = window.confirm(
              `Delete custom role “${roleName}”? This cannot be undone.`,
            );

            if (!confirmed) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={roleId} />
          <Button
            type="submit"
            variant="destructive"
            disabled={deletePending}
          >
            <Trash2 />
            {deletePending ? "Deleting…" : "Delete role"}
          </Button>
        </form>
      )}
    </div>
  );
}
