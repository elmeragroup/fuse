/**
 * Measures for first-line alignment: where a glyph sits against the first rendered line of a
 * title. The oracle is the text itself, read through a DOM `Range`, never the classes that place
 * the glyph.
 */

/**
 * The host stylesheets a component ships into. `dist/styles.css` carries no preflight, so a
 * bare import is the preflight-free host. A Tailwind consumer's preflight resets boxes in its base
 * layer, below the utilities: it zeroes every margin and padding and displays replaced and
 * embedded media as blocks. `PREFLIGHT_BASE_LAYER` reproduces those resets.
 */
export const HOSTS = ["preflight", "preflight-free"] as const;

/** One host stylesheet. */
export type Host = (typeof HOSTS)[number];

/**
 * Tailwind preflight's base-layer box resets: margins and padding zeroed, and replaced and
 * embedded media displayed as blocks, aligned to the middle.
 */
const PREFLIGHT_BASE_LAYER =
  "@layer base { *, ::before, ::after { margin: 0; padding: 0; } img, svg, video, canvas, audio, iframe, embed, object { display: block; vertical-align: middle; } }";

/**
 * The style text a test mounts for `host`: the preflight reset, or nothing for a bare host.
 *
 * @param host - The host to reproduce.
 * @returns The CSS to put in a `<style>` element.
 */
export function hostCss(host: Host): string {
  return host === "preflight" ? PREFLIGHT_BASE_LAYER : "";
}

/**
 * The viewport y of the middle of an element's border box.
 *
 * @param element - The element to measure.
 * @returns Its vertical centre in viewport pixels.
 */
export function centreY(element: Element): number {
  const box = element.getBoundingClientRect();
  return box.top + box.height / 2;
}
