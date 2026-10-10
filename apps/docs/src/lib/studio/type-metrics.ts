const PX_LENGTH = /^(-?\d+(?:\.\d+)?)px$/u;

/** A computed length in px, such as `14px`, or `undefined` for a keyword or another unit. */
function pxOf(css: string): number | undefined {
  const match = PX_LENGTH.exec(css.trim());
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

function formatPx(css: string): string {
  const px = pxOf(css);
  return px === undefined ? "–" : String(Number(px.toFixed(2)));
}

/**
 * A type pair as the browser computed it, such as `14 / 20 px`: the font size over the line
 * height, each to two decimals at most.
 *
 * @param fontSize - The computed `font-size`.
 * @param lineHeight - The computed `line-height`.
 */
export function formatTypePair(fontSize: string, lineHeight: string): string {
  return `${formatPx(fontSize)} / ${formatPx(lineHeight)} px`;
}
