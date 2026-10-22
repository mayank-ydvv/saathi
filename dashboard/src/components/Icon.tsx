/** Small inline SVG icons (stroke style, 24×24). Decorative unless a `title` is given. */
const PATHS = {
  check: "M20 6 9 17l-5-5",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  alert: "M12 9v4m0 4h.01M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  today: "M3 12h4l3-8 4 16 3-8h4",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14ZM20 17v4H6.5a2.5 2.5 0 0 1 0-5",
  chart: "M3 3v18h18M7 15l4-4 3 3 5-6",
  camera: "M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Zm9 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  refresh: "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5",
  close: "M18 6 6 18M6 6l12 12",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
  chevronLeft: "m15 18-6-6 6-6",
  chevronRight: "m9 18 6-6-6-6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className = "h-5 w-5",
  title,
}: {
  name: IconName;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
