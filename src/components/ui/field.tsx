import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { UI_TYPOGRAPHY } from "@/src/config/ui-typography";

type FieldLabelProps = ComponentProps<"label">;

/** Standard form field label. */
export function FieldLabel({ className, ...props }: FieldLabelProps) {
  return (
    <label className={cn(UI_TYPOGRAPHY.fieldLabel, className)} {...props} />
  );
}

type FieldHintProps = {
  children: ReactNode;
  className?: string;
};

/** Muted helper text under a field. */
export function FieldHint({ children, className }: FieldHintProps) {
  return (
    <p className={cn("mt-2", UI_TYPOGRAPHY.fieldHint, className)}>{children}</p>
  );
}

type FieldErrorProps = {
  children: ReactNode;
  className?: string;
};

/** Field-level validation error. */
export function FieldError({ children, className }: FieldErrorProps) {
  return (
    <p className={cn("mt-2", UI_TYPOGRAPHY.fieldError, className)}>
      {children}
    </p>
  );
}

type MetaLabelProps = {
  children: ReactNode;
  className?: string;
};

/** Small muted label above stat tiles / metadata values. */
export function MetaLabel({ children, className }: MetaLabelProps) {
  return <p className={cn(UI_TYPOGRAPHY.metaLabel, className)}>{children}</p>;
}
