import { BellRing } from "lucide-react";
import type { TimelineEvent } from "../api/types";
import { cn } from "../lib/cn";

/** The doorbell snapshot, or a quiet placeholder when the ring came without one. */
export function VisitorThumb({ event, alt = "", className }: { event: TimelineEvent; alt?: string; className?: string }) {
  if (event.snapshot_url) {
    return <img src={event.snapshot_url} alt={alt} loading="lazy" className={cn("bg-surface-2 object-cover", className)} />;
  }
  return (
    <div className={cn("grid place-items-center bg-surface-2 text-muted", className)} aria-hidden="true">
      <BellRing className="size-1/3 max-h-12 max-w-12" />
    </div>
  );
}
