import { toast as sonnerToast } from "sonner"

/**
 * Single entry point for transient toasts.
 * Modules should call these helpers so position and styling stay consistent.
 */
export const toast = {
  success: (title: string, description?: string) =>
    sonnerToast.success(title, { description }),
  information: (title: string, description?: string) =>
    sonnerToast.info(title, { description }),
  warning: (title: string, description?: string) =>
    sonnerToast.warning(title, { description }),
  error: (title: string, description?: string) =>
    sonnerToast.error(title, { description }),
  critical: (title: string, description?: string) =>
    sonnerToast.error(title, {
      description,
      className: "border-destructive/40",
    }),
  dismiss: sonnerToast.dismiss,
  message: sonnerToast,
}

export { sonnerToast }
