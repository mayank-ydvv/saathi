import type { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Screen tone behind the content: light status bar text on dark screens. */
  dark?: boolean;
  className?: string;
  style?: CSSProperties;
};

/**
 * A plain CSS phone (no product image), sized by its width. Everything inside is in `em`
 * of a font-size tied to the width, so the screen content scales with the phone.
 */
export function Phone({ children, dark = false, className = "", style }: Props) {
  return (
    <div
      className={`relative aspect-[9/19.2] rounded-[14%/6.6%] bg-[#111] p-[3.2%] ${className}`}
      style={{ containerType: "inline-size", ...style }}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-[11.5%/5.3%] bg-parchment"
        style={{ fontSize: "6.2cqw" }}
      >
        {children}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-[1.6em] pt-[0.9em] text-[0.62em] ${dark ? "text-white" : "text-graphite"}`}
        >
          <span>9:41</span>
          <span className="tracking-[0.1em]">▪▪▪ ◔</span>
        </div>
        <div className="absolute left-1/2 top-[1.4%] z-10 h-[3.4%] w-[30%] -translate-x-1/2 rounded-full bg-[#111]" />
      </div>
    </div>
  );
}
