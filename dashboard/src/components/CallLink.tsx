import { Phone } from "lucide-react";
import { cn } from "../lib/cn";

/** "Call Kamala": a tel: link, shown only when the home has the parent's number. */
export function CallLink({ phone, name, className }: { phone: string; name?: string; className?: string }) {
  return (
    <a
      href={`tel:${phone.replace(/[^\d+]/g, "")}`}
      className={cn(
        "press inline-flex items-center justify-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2",
        className,
      )}
    >
      <Phone className="size-4" aria-hidden="true" />
      Call {name ?? "now"}
    </a>
  );
}
