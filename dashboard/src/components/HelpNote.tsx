import { ChevronDown, CircleHelp } from "lucide-react";
import type { ReactNode } from "react";

/** A short, collapsible "What does this mean?" note: closed by default, one per page. */
export function HelpNote({ title = "What does this mean?", children }: { title?: string; children: ReactNode }) {
  return (
    <details className="group rounded-2xl border border-line bg-surface-2/70">
      <summary className="flex cursor-pointer items-center gap-2.5 px-4 py-3 text-[15px] font-medium text-muted hover:text-ink">
        <CircleHelp className="size-[18px] shrink-0" aria-hidden="true" />
        <span className="flex-1">{title}</span>
        <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-2 px-4 pb-4 text-[15px] leading-relaxed text-muted [&_strong]:font-semibold [&_strong]:text-ink">
        {children}
      </div>
    </details>
  );
}
