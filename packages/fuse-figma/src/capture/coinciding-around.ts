/**
 * How many of the elements around a root lie exactly behind it, which decides whose background the
 * root shows across its box. The capture's page function reads the root's border box, the padding
 * box of each element around it, and which of them round a corner. This module takes the fact from
 * Chromium's pixels through `pixel-probe.ts`: for each element whose padding box is the root's
 * border box, with nothing rounded out to it, it hides the root's tree and has the probe screenshot
 * that element's background across the root's box.
 */
import type { CDPSession } from "playwright";

import { withPixelProbe } from "./pixel-probe.ts";
import type { Rect } from "./pixel-probe.ts";

/** An element around the root as the page reads it: its padding box, its border box less its border, and whether it rounds a corner. */
export type AroundBox = {
  readonly padding: Rect;
  readonly rounded: boolean;
};

/**
 * What the page reads for the measurement: the root's border box and whether it rounds a corner,
 * and from the root's parent outward up to the comparison cell, each element's {@link AroundBox}. An
 * element rounds a corner where any of its computed corner radii is not zero, which covers the
 * logical properties, as `rounded-s-full` sets `border-start-start-radius`, inline styles and a
 * `calc()`.
 */
export type AroundReading = {
  readonly root: Rect;
  readonly rounded: boolean;
  readonly around: readonly AroundBox[];
};

/**
 * How many of the elements around a root, innermost first, have the root's border box as their
 * padding box and round no corner, with the root rounding none, up to the first that does not. Only
 * these can lie exactly behind the root, as the Sidebar Provider's wrapper holds the panel's
 * container. An element with padding or border around the root, as a popup's content around its
 * rows, is no such element, and neither is any further out. A rounded corner of the root or of an
 * element out to the candidate shows what lies behind it, so the root shows no one fill across its
 * box there, and the count stops.
 */
function boxesBehind({ root, rounded, around }: AroundReading): number {
  if (rounded) {
    return 0;
  }
  // Two edges half a pixel apart meet, for subpixel layout.
  const same = (a: number, b: number): boolean => Math.abs(a - b) <= 0.5;
  const index = around.findIndex(
    ({ padding, rounded: round }) =>
      round ||
      !(
        same(padding.left, root.left) &&
        same(padding.top, root.top) &&
        same(padding.right, root.right) &&
        same(padding.bottom, root.bottom)
      )
  );
  return index === -1 ? around.length : index;
}

/**
 * How many of the elements around a root, innermost first, lie exactly behind it, measured from
 * Chromium's pixels. A candidate is an element {@link boxesBehind} counts. It lies behind the root
 * where the probe finds its background across the pixels Chromium paints for the root's border box,
 * in its own fill where that is an opaque color and in each sentinel. A candidate whose background
 * color is partly transparent fails, and so does one whose shots would stage an element that runs
 * an animation or transition. The candidates go innermost first, up to the first that fails.
 *
 * @param cdp - A DevTools session on the page.
 * @param rootObjectId - The root's remote object.
 * @param reading - The boxes the page read for the root.
 * @returns How many elements, innermost first, lie exactly behind the root.
 * @throws An `Error` where a page function throws, a defect in it or in the page, which stops the
 *   capture as `measuredFacts` does.
 */
export async function coincidingAround(
  cdp: CDPSession,
  rootObjectId: string,
  reading: AroundReading
): Promise<number> {
  const candidates = boxesBehind(reading);
  if (candidates === 0) {
    return 0;
  }
  return withPixelProbe(cdp, rootObjectId, async (probe) => {
    for (let level = 0; level < candidates; level += 1) {
      if (!(await probe.shows({ source: STAGE_IN_PAGE, args: [level] }, reading.root))) {
        return level;
      }
    }
    return candidates;
  });
}

/**
 * The staging of a candidate `level` steps out from the root, called on the root, which returns
 * the probe's scene.
 *
 * It hides the root's tree with `opacity: 0`. A descendant in the top layer, an open popover or a
 * modal dialog, paints apart from the root's opacity, so it hides that too. The probe styles no
 * pseudo-element, so a modal dialog's `::backdrop` stays, which can only fail the shot. It clears
 * the backgrounds of the candidates inside the one measured and paints that one.
 *
 * The comparison page hides a client cell and shows only its measured roots, so a popup's crop
 * shows none of its trigger. The staging shows the cell as the app does, so the candidate's
 * background and whatever paints over it draw.
 */
const STAGE_IN_PAGE = `function (level) {
  const around = [];
  for (let up = this.parentElement; up !== null && !up.hasAttribute("data-compare-cell"); up = up.parentElement) { around.push(up); }
  const cell = this.closest("[data-compare-cell]");
  const topLayer = [];
  const visit = (scope) => {
    for (const element of scope.querySelectorAll("*")) {
      if (element.matches(":popover-open, :modal")) { topLayer.push(element); }
      if (element.shadowRoot !== null) { visit(element.shadowRoot); }
    }
  };
  visit(this);
  if (this.shadowRoot !== null) { visit(this.shadowRoot); }
  return {
    hidden: [this, ...topLayer],
    cleared: around.slice(0, level),
    painted: around[level],
    shown: cell === null || cell === this ? [] : [cell],
  };
}`;
