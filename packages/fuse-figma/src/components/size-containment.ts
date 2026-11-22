/**
 * Inline-size containment, which Tailwind's `@container` writes, and which drops only where no
 * content sizes the box's width. `box-sizing.ts` reads it while it reads a box's sizing.
 */

import type { Room } from "./box-room";
import { normalizeCss } from "./css-values";
import type { SizeSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";

/** Why inline-size containment drops on a box its parent stretches across. */
const STRETCHED_CONTAINMENT =
  "a column, a grid in one column or a block stretches the box across, which no content sizes";

/** Why inline-size containment drops on a root the preview's host sets the width of. */
const HOSTED_CONTAINMENT = "the root is block-level in the preview's block host, which sets its width";

/** Why inline-size containment drops on a box whose own width reads as a fixed length. */
const DECLARED_CONTAINMENT =
  "the box's own width is a fixed length, which no content sizes, and no flex or grid line sizes it along that width";

/**
 * The sizing keywords whose length content sets (CSS Sizing 3 §5.2), and `stretch`, which the build
 * does not resolve, as a `min-width` or `max-width` may hold them. Its prefixed spelling
 * `-webkit-fill-available` starts with a hyphen, where `\b` finds no word boundary at the start of
 * a value, so the pattern matches the whole keyword after no letter, digit or hyphen.
 */
const INTRINSIC_LIMIT =
  /\b(?:min-content|max-content|fit-content|stretch)\b|(?<![\w-])-webkit-fill-available\b/;

/**
 * Read `container-type: inline-size`, which Tailwind's `@container` writes through the `container`
 * shorthand, its name before a slash. Inline-size containment sizes a box's width as if it held
 * nothing (CSS Containment 2 §3.2), which also drops the content-based minimum of a flex or grid
 * item (CSS Flexbox 1 §4.5), so it changes nothing only where no content contributes to the width.
 * The build knows three such widths, each in a place where no flex or grid line sizes the box along
 * its width, and each where the box's `min-width` and `max-width` hold no sizing keyword that
 * content sets: a `min-content` minimum lifts the width to what the box holds, which the containment
 * takes to nothing (CSS 2.1 §10.4).
 *
 * - a box with no `width` its parent stretches across: a column's or a grid's item, whose cross size
 *   the parent gives it, or a block in a block, whose width is its containing block's (CSS 2.1
 *   §10.3.3);
 * - a block-level root with no `width`, which takes its preview's width in the block host it
 *   renders in;
 * - a box in either place whose own `width` reads as a fixed length, a length or a percentage of
 *   that fixed width (CSS 2.1 §10.2).
 *
 * A `width` of `auto` is the width the box takes with none, so it counts as no `width`.
 *
 * A width that does not read as fixed, a flex item that grows or shrinks along a row, and a box that
 * hugs its content keep the containment unmapped, since there content or a sibling's share sets the
 * width. A container name only lets a query find the box, so it draws nothing either way.
 *
 * @param reader - The box's style.
 * @param room - The room the box's parent gives it.
 * @param width - How the box's own width sizes it.
 */
export function readContainment(reader: LayerStyle, room: Room, width: SizeSpec): void {
  const { auto, zeroBasis } = room.horizontal;
  const placed = auto.kind === "fill" || auto.kind === "fixed";
  const limited = ["min-width", "max-width"].some((property) =>
    INTRINSIC_LIMIT.test(normalizeCss(reader.resolved(property) ?? ""))
  );
  const detail =
    zeroBasis === true || !placed || limited
      ? undefined
      : normalizeCss(reader.resolved("width") ?? "auto") === "auto"
        ? auto.kind === "fill"
          ? STRETCHED_CONTAINMENT
          : HOSTED_CONTAINMENT
        : width.kind === "fixed"
          ? DECLARED_CONTAINMENT
          : undefined;
  for (const property of ["container-type", "container"]) {
    reader.read(
      property,
      (value) =>
        detail !== undefined && normalizeCss(value.split("/").at(-1) ?? "") === "inline-size"
          ? value
          : undefined,
      () => ({ outcome: "dropped", detail: detail ?? "" }),
      []
    );
  }
}
