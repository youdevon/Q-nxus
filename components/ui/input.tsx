import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

type InputProps = Omit<React.ComponentProps<"input">, "value" | "defaultValue"> &
  Pick<
    React.ComponentProps<typeof InputPrimitive>,
    "value" | "defaultValue" | "onValueChange"
  >;

function Input({
  className,
  type,
  onChange,
  onValueChange,
  defaultValue,
  value,
  ...props
}: InputProps) {
  // Base UI warns when an uncontrolled FieldControl's defaultValue changes
  // after init. Remount the primitive when that happens so filter/edit forms
  // that swap defaults stay correct without converting every field to
  // controlled state.
  const remountKey =
    value === undefined && defaultValue !== undefined
      ? `default:${String(defaultValue)}`
      : undefined;

  return (
    <InputPrimitive
      key={remountKey}
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
      defaultValue={defaultValue}
      value={value}
      // Base UI's controlled path is onValueChange; keep onChange for callers
      // that still use the native event shape. Set after spread so they win.
      onValueChange={onValueChange}
      onChange={onChange}
    />
  );
}

export { Input };
