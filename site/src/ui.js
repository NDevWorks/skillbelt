// Shared bits for the playground and the belt card.
export const REPO = "https://github.com/NDevWorks/skillbelt";
export const LESSON_URL = (lesson) => `${REPO}/blob/main/${lesson}`;

export const BELT_COLORS = {
  white: "#FFFFFF",
  yellow: "#F2C230",
  green: "#2E9E5B",
  blue: "#2F6BD8",
  black: "#17191E",
};
// Stitching that stays visible on each belt color
export const STITCH = { white: "#C9CCC4", yellow: "#B88F14", green: "#1E7243", blue: "#1F4FA8", black: "#3A3E47" };

export const esc = (t) =>
  String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Escape, then turn `code` into <code>code</code>
export const inlineCode = (t) => esc(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\n/g, "<br>");

// A martial-arts belt tied in a knot. Without a belt id, it's an empty outline.
export function beltSvg(id) {
  const fill = id ? BELT_COLORS[id] : "none";
  const stitch = id ? STITCH[id] : "#B9BDB4";
  const edge = id === "white" || !id ? "#B9BDB4" : fill;
  const dash = id ? "" : ' stroke-dasharray="6 6"';
  return `<svg viewBox="0 0 640 132" role="img" aria-label="${id ? `${id} belt` : "no belt yet"}" xmlns="http://www.w3.org/2000/svg">
  <g stroke="${edge}" stroke-width="2"${dash}>
    <rect x="4" y="30" width="632" height="40" rx="6" fill="${fill}"/>
    <path d="M300 68 L262 124 L292 128 L322 74 Z" fill="${fill}"/>
    <path d="M340 68 L378 124 L348 128 L318 74 Z" fill="${fill}"/>
    <rect x="296" y="22" width="48" height="56" rx="10" fill="${fill}"/>
  </g>
  <g stroke="${stitch}" stroke-width="1.5" stroke-dasharray="4 5" fill="none">
    <path d="M12 40 H288 M12 60 H288 M352 40 H628 M352 60 H628"/>
  </g>
</svg>`;
}
