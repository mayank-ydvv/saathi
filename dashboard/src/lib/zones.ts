/** One colour per room (tokens in index.css), shared by the timeline, charts and heatmap. */
export const zoneColour = (zone: string) => `var(--zone-${zone}, var(--accent))`;

/** The same colour, faded to `pct`% for lane and cell backgrounds. */
export const zoneTint = (zone: string, pct: number) => `color-mix(in oklab, ${zoneColour(zone)} ${pct}%, transparent)`;
