import type { ReactNode } from "react"

type PageShellProps = {
  children: ReactNode
  /** `md` for detail/forms (max-w-5xl), `lg` for directories/workspaces (max-w-6xl). */
  size?: "md" | "lg"
  className?: string
}

const sizeClass = {
  md: "max-w-5xl",
  lg: "max-w-6xl",
} as const

export function PageShell({
  children,
  size = "md",
  className,
}: PageShellProps) {
  return (
    <div
      className={[
        "mx-auto flex w-full flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8",
        sizeClass[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  )
}
