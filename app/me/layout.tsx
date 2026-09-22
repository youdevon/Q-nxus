import type { ReactNode } from "react";

/** Passthrough — profile chrome lives in `(profile)/layout.tsx` so print routes stay clean. */
export default function MeLayout({ children }: { children: ReactNode }) {
  return children;
}
