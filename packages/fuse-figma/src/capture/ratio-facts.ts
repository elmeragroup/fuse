/**
 * The side a preferred aspect ratio sets on a box, as the capture's page function reads it for the
 * fact `ratio`. A box whose ratio sets one side from the other draws in Figma with that side fixed
 * at the ratio's length and an aspect lock (PG18, PG19). The function is passed to the page as its
 * source, so it reads nothing outside its own body and the helpers it is handed.
 */

/** What one reading of a box's ratio found: the side the ratio sets, the ratio, and the border box. */
export type RatioReading = {
  readonly sets: "width" | "height";
  /** The computed `aspect-ratio`, which every mode must keep. */
  readonly value: string;
  readonly width: number;
  readonly height: number;
};

/** The helpers the page hands {@link ratioReading}. */
type PageHelpers = {
  /** Writes styles for a measure and puts them back. */
  readonly withStyles: (
    writes: readonly (readonly [Element, string, string])[],
    measure: () => boolean
  ) => boolean;
  /** The layout unit in CSS pixels within which two lengths are one. */
  readonly unit: number;
  /** How far, in CSS pixels, the reading moves the side the ratio reads. */
  readonly raise: number;
};

/**
 * Read the side a box's preferred aspect ratio sets from the other (CSS Sizing 4 §4.2). The box has
 * a ratio with no `auto` in it, and its border box keeps the ratio within the layout unit. The ratio
 * sets one side, which this calls the set side, from the other, the read side, where:
 *
 * - the set side's computed length is `auto`, its minimum `auto` or zero and its maximum `none`;
 * - a flex basis that sizes the set side is `auto`: on the height, only in a flex column, whose
 *   main axis is vertical; on the width, in any parent, as the build reads Button's `icon-inline`;
 * - the read side's computed length is a length, on the width only;
 * - with the read side `raise` pixels longer, the set side follows it through the ratio. A flex row
 *   may shrink the wider box straight back (CSS Flexbox 1 §9.7), so where the read side stays where
 *   it was, the reading makes it `raise` pixels shorter instead, and where it stays then too, the
 *   ratio sets neither side. On the width, the height must also move by the whole `raise`.
 *
 * The height is the set side first, where both qualify. Content longer than the ratio's length,
 * which an `overflow: visible` box grows to hold (§4.3) and which the automatic minimum keeps on
 * the width (§5.1), leaves the box out of ratio, and a flex basis, a stretch or a length a mode sets
 * makes a box keep its set side when the read side moves. The page reads it in every mode and keeps
 * the fact only where each reading is the first. Runs in the page.
 *
 * @param element - The box.
 * @param helpers - What the page hands in.
 * @returns The side the ratio sets with the box, or undefined where it sets none.
 */
export function ratioReading(element: Element, helpers: PageHelpers): RatioReading | undefined {
  const { withStyles, unit, raise } = helpers;
  const near = (left: number, right: number): boolean => Math.abs(left - right) < unit;
  const style = getComputedStyle(element);
  const value = style.aspectRatio;
  if (value.includes("auto")) {
    return undefined;
  }
  const [across = 0, down = 1, ...rest] = value.split("/").map(Number);
  if (rest.length > 0 || !(across > 0) || !(down > 0)) {
    return undefined;
  }
  const perWidth = down / across;
  const box = element.getBoundingClientRect();
  if (!near(box.height, box.width * perWidth)) {
    return undefined;
  }
  const map = element.computedStyleMap();
  const parent = element.parentElement === null ? undefined : getComputedStyle(element.parentElement);
  const inColumn =
    parent !== undefined && parent.display.endsWith("flex") && parent.flexDirection.startsWith("column");
  const free = (length: string, min: string, max: string): boolean =>
    String(map.get(length)) === "auto" &&
    ["auto", "0px"].includes(style.getPropertyValue(min)) &&
    style.getPropertyValue(max) === "none";
  // Whether the box keeps its ratio with `side` `raise` pixels past its used length, or short of
  // it where the longer one leaves the side's used length as it was, measured by `holds`.
  const follows = (
    side: "width" | "height",
    used: string,
    holds: (movedBox: DOMRect, step: number) => boolean
  ): boolean => {
    for (const step of [raise, -raise]) {
      const writes: readonly (readonly [Element, string, string])[] = [
        [element, side, `calc(${used} + ${String(step)}px)`],
      ];
      if (withStyles(writes, () => !near(element.getBoundingClientRect()[side], box[side]))) {
        return withStyles(writes, () => holds(element.getBoundingClientRect(), step));
      }
    }
    return false;
  };
  const setsHeight =
    free("height", "min-height", "max-height") &&
    (!inColumn || style.flexBasis === "auto") &&
    follows("width", style.width, (wider) => near(wider.height, wider.width * perWidth));
  const setsWidth =
    !setsHeight &&
    free("width", "min-width", "max-width") &&
    style.flexBasis === "auto" &&
    String(map.get("height")).endsWith("px") &&
    follows(
      "height",
      style.height,
      (taller, step) => near(taller.height, box.height + step) && near(taller.height, taller.width * perWidth)
    );
  const sets = setsHeight ? "height" : setsWidth ? "width" : undefined;
  return sets === undefined ? undefined : { sets, value, width: box.width, height: box.height };
}
