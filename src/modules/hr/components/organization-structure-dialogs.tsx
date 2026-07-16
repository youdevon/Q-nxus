"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { BriefcaseBusiness, Building2, Save } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { FieldHint, FieldLabel } from "@/src/components/ui/field";
import {
  createDepartment,
  createPosition,
  updateDepartment,
  updatePosition,
  type StructureFormState,
} from "@/src/modules/hr/actions/manage-people-structure";
import type { DepartmentRecord } from "@/src/modules/hr/data/get-people-structure";

const initialState: StructureFormState = {
  status: "idle",
  message: "",
};

type DepartmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: DepartmentRecord | null;
  onSuccess?: (entityId?: string) => void;
};

function DepartmentDialogForm({
  department,
  onSuccess,
}: {
  department?: DepartmentRecord | null;
  onSuccess: (entityId?: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useId();
  const action = department ? updateDepartment : createDepartment;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      formRef.current?.reset();
      onSuccess(state.entityId ?? department?.id);
    }

    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "conflict") {
      toast.warning(state.message);
    }
  }, [state, onSuccess, department?.id]);

  return (
    <form ref={formRef} id={formId} action={formAction} className="space-y-4">
      {department ? (
        <>
          <input type="hidden" name="id" value={department.id} />
          <input type="hidden" name="updatedAt" value={department.updatedAt} />
        </>
      ) : null}

      {state.status === "error" || state.status === "conflict" ? (
        <div
          role="alert"
          className="border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          {state.message}
        </div>
      ) : null}

      <div>
        <FieldLabel htmlFor={`${formId}-name`}>Department name</FieldLabel>
        <Input
          id={`${formId}-name`}
          name="name"
          defaultValue={department?.name ?? ""}
          className="mt-2"
          required
        />
      </div>

      <div>
        <FieldLabel htmlFor={`${formId}-code`}>Code</FieldLabel>
        <Input
          id={`${formId}-code`}
          name="code"
          defaultValue={department?.code ?? ""}
          className="mt-2 font-mono"
        />
      </div>

      <div>
        <FieldLabel htmlFor={`${formId}-description`}>Description</FieldLabel>
        <Textarea
          id={`${formId}-description`}
          name="description"
          defaultValue={department?.description ?? ""}
          rows={3}
          className="mt-2"
        />
      </div>

      {department ? (
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={department.isActive}
            className="size-4"
          />
          <span className="text-sm font-medium">Department is active</span>
        </label>
      ) : null}

      <DialogFooter className="-mx-6 -mb-6 mt-1">
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" form={formId} disabled={pending}>
          <Save />
          {pending ? "Saving…" : department ? "Save department" : "Create department"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function DepartmentStructureDialog({
  open,
  onOpenChange,
  department,
  onSuccess,
}: DepartmentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Building2 className="size-4 text-muted-foreground" />
            {department ? "Edit department" : "New department"}
          </DialogTitle>
          <DialogDescription>
            {department
              ? "Update the department name, code, and status."
              : "Create a department to hold positions and reporting lines."}
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <DepartmentDialogForm
            department={department}
            onSuccess={(entityId) => {
              onSuccess?.(entityId);
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type PositionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: DepartmentRecord[];
  defaultDepartmentId?: string;
  position?: {
    id: string;
    title: string;
    code: string | null;
    description: string | null;
    systemRoleCode: string | null;
    isActive: boolean;
    updatedAt: string;
    departmentName: string;
  } | null;
  onSuccess?: (entityId?: string) => void;
};

function PositionDialogForm({
  departments,
  defaultDepartmentId,
  position,
  onSuccess,
}: {
  departments: DepartmentRecord[];
  defaultDepartmentId?: string;
  position?: PositionDialogProps["position"];
  onSuccess: (entityId?: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useId();
  const action = position ? updatePosition : createPosition;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      formRef.current?.reset();
      onSuccess(state.entityId ?? position?.id);
    }

    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "conflict") {
      toast.warning(state.message);
    }
  }, [state, onSuccess, position?.id]);

  const activeDepartments = departments.filter((department) => department.isActive);

  return (
    <form ref={formRef} id={formId} action={formAction} className="space-y-4">
      {position ? (
        <>
          <input type="hidden" name="id" value={position.id} />
          <input type="hidden" name="updatedAt" value={position.updatedAt} />
        </>
      ) : null}

      {state.status === "error" || state.status === "conflict" ? (
        <div
          role="alert"
          className="border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          {state.message}
        </div>
      ) : null}

      {!position ? (
        <div>
          <FieldLabel htmlFor={`${formId}-departmentId`}>Department</FieldLabel>
          <select
            id={`${formId}-departmentId`}
            name="departmentId"
            defaultValue={defaultDepartmentId ?? ""}
            className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
            required
          >
            <option value="">Select department</option>
            {activeDepartments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium">Department</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {position.departmentName}
          </p>
        </div>
      )}

      <div>
        <FieldLabel htmlFor={`${formId}-title`}>Position title</FieldLabel>
        <Input
          id={`${formId}-title`}
          name="title"
          defaultValue={position?.title ?? ""}
          className="mt-2"
          required
        />
      </div>

      <div>
        <FieldLabel htmlFor={`${formId}-code`}>Code</FieldLabel>
        <Input
          id={`${formId}-code`}
          name="code"
          defaultValue={position?.code ?? ""}
          className="mt-2 font-mono"
        />
      </div>

      <div>
        <FieldLabel htmlFor={`${formId}-systemRoleCode`}>
          System access role
        </FieldLabel>
        <select
          id={`${formId}-systemRoleCode`}
          name="systemRoleCode"
          defaultValue={position?.systemRoleCode ?? ""}
          className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Employee self-service only</option>
          <option value="LEAVE_APPROVER">Leave Approver</option>
          <option value="HR_ADMINISTRATOR">HR Administrator</option>
          <option value="SYSTEM_ADMINISTRATOR">System Administrator</option>
        </select>
        <FieldHint>
          Holders of this position receive the selected elevated access in
          addition to employee self-service.
        </FieldHint>
      </div>

      <div>
        <FieldLabel htmlFor={`${formId}-description`}>Description</FieldLabel>
        <Textarea
          id={`${formId}-description`}
          name="description"
          defaultValue={position?.description ?? ""}
          rows={3}
          className="mt-2"
        />
      </div>

      {position ? (
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={position.isActive}
            className="size-4"
          />
          <span className="text-sm font-medium">Position is active</span>
        </label>
      ) : null}

      <DialogFooter className="-mx-6 -mb-6 mt-1">
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" form={formId} disabled={pending}>
          <Save />
          {pending ? "Saving…" : position ? "Save position" : "Create position"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function PositionStructureDialog({
  open,
  onOpenChange,
  departments,
  defaultDepartmentId,
  position,
  onSuccess,
}: PositionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BriefcaseBusiness className="size-4 text-muted-foreground" />
            {position ? "Edit position" : "New position"}
          </DialogTitle>
          <DialogDescription>
            {position
              ? "Update the position title, code, and access role."
              : "Create a position within a department, then set who it reports to."}
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <PositionDialogForm
            departments={departments}
            defaultDepartmentId={defaultDepartmentId}
            position={position}
            onSuccess={(entityId) => {
              onSuccess?.(entityId);
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
