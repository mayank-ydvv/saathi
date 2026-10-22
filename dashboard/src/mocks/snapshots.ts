/**
 * Doorbell snapshots for mock mode: simple original SVG drawings (no photos, nothing
 * copyrighted), as data URLs so they work with no backend.
 */
function svg(body: string): string {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240">
<rect width="320" height="240" fill="#3b4148"/>
<rect x="0" y="170" width="320" height="70" fill="#565c63"/>
<rect x="210" y="40" width="80" height="150" fill="#6b5a4a" stroke="#2c2622" stroke-width="4"/>
<circle cx="276" cy="118" r="4" fill="#d9c9a3"/>
${body}
<rect x="8" y="8" width="128" height="20" rx="4" fill="#000" opacity="0.45"/>
<text x="16" y="22" font-family="monospace" font-size="11" fill="#fff">FRONT DOOR · CAM</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(doc)}`;
}

const person = (shirt: string) => `
<circle cx="120" cy="78" r="22" fill="#c99a7a"/>
<path d="M82 200 Q84 120 120 112 Q156 120 158 200 Z" fill="${shirt}"/>`;

export const COURIER_SNAPSHOT = svg(`${person("#c0392b")}
<rect x="104" y="128" width="32" height="8" fill="#f1c40f"/>
<rect x="92" y="140" width="60" height="44" fill="#b8874f" stroke="#7a5630" stroke-width="3"/>`);

export const STRANGER_SNAPSHOT = svg(person("#2f3640"));
