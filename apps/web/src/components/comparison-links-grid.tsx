import type { ReactNode } from "react";

export function ComparisonLinksGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,28rem),1fr))] gap-3">
      {children}
    </div>
  );
}
