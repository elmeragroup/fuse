/**
 * The part that grows along its box's direction: the `flex` of each part in a box's flow, the one
 * part that fills the room the others leave, a flex row's one layer that grows from its content,
 * and a block container's parts, whose flex sizes nothing. `box-mapping.ts` reads the growing part
 * here, and `box-room.ts` gives it its room.
 */

import { HEIGHT, WIDTH } from "./box-axis";
import type { AxisProperties } from "./box-axis";
import type { Holder } from "./box-room";
import { readCentredGrowth } from "./centred-row";
import type { CentredGrowth } from "./centred-row";
import { readContentShares } from "./content-shares";
import { evaluateLength, evaluateNumber, normalizeCss } from "./css-values";
import { keepsOwnSize, keepsOwnWidth } from "./flex-item-width";
import type { LayerStyle } from "./layer-style";

/**
 * The part that grows along its box's direction: its place among the parts in the box's flow, and
 * whether it `fills` the room there, and is the box's one layer, which grows from its content, as
 * `loneGrowth` reads it, where a `flex: 1` part grows from a zero basis, or is `centred` between two
 * others, as `readCentredGrowth` in `centred-row.ts` reads it.
 */
export type Growth =
  | { readonly kind: "fills"; readonly place: number; readonly alone: boolean }
  | CentredGrowth;

/** The properties that size a flex item along its line, which nothing reads outside a flex box. */
const FLEX_ITEM = ["flex", "flex-grow", "flex-shrink", "flex-basis"] as const;

/** Why a block's part drops its flex. */
const NO_FLEX_ITEM =
  "the part's box is a block container, so the part is no flex item and its flex sizes nothing (CSS Flexbox 1 §7)";

/**
 * Read how the parts in a box's flow size along its direction as items. A block container lays its
 * parts out as blocks and inlines and reads no flex (CSS Flexbox 1 §7), so each part's flex drops.
 * Any other box reads the parts' `flex` as {@link readGrowth} says.
 *
 * @param holder - The box.
 * @param parts - The style of each part in the box's flow.
 * @param measured - What {@link readGrowth} reads from the capture's measurement and the parts.
 * @param block - Whether the box is a plain block container, as `isPlainBlock` reads it.
 * @returns The part that fills the box along its direction, or undefined for none.
 */
export function readItemSizing(
  holder: Holder,
  parts: readonly LayerStyle[],
  measured: GrowthMeasure,
  block: boolean
): Growth | undefined {
  if (!block) {
    return readGrowth(holder, parts, measured);
  }
  for (const part of parts) {
    for (const property of FLEX_ITEM) {
      part.read(
        property,
        (value) => value,
        () => ({ outcome: "dropped", detail: NO_FLEX_ITEM }),
        []
      );
    }
  }
  return undefined;
}

/**
 * Why a `flex` that keeps the item's own size drops, as `none` does.
 *
 * @param written - The `flex` as written.
 */
function noFlex(written: string): string {
  return `\`${normalizeCss(written)}\` neither grows nor shrinks the item from its own size (CSS Flexbox 1 §7.1.1), as Figma's auto layout keeps a fixed or hugging layer`;
}

/**
 * Read the `flex` of the parts in a flex box's flow. A box that hugs its length along its direction,
 * with no limit there that can change that length, is as long as its layers, so it leaves no free
 * space (CSS Flexbox 1 §9.7), and the one part that grows keeps its own length, as `flex: 1` does
 * from its zero basis. In a box of definite length along its direction the one part that grows takes
 * the room the others leave, which Figma's fill takes, where it sets no length of its own along the
 * direction, since its zero basis ignores one. Any other `flex` stays unread, so it lands unmapped: a
 * minimum can leave room past the layers and a maximum can take room away, and two parts that grow
 * share the free space by their grow, except where the capture measured each at its own content
 * width, as `content-shares.ts` reads them.
 *
 * @param holder - The box.
 * @param parts - The style of each part in the box's flow.
 * @param measured - The capture's measurement that the box's content stays under its `max-height`,
 *   and that its growing parts each stay at their own content width, and which parts hold only a
 *   label.
 * @returns The part that fills the box along its direction, or undefined for none.
 */
function readGrowth(
  holder: Holder,
  parts: readonly LayerStyle[],
  measured: GrowthMeasure
): Growth | undefined {
  const { underMaxHeight } = measured;
  const { layout, sizing, style } = holder;
  const horizontal = layout.direction === "HORIZONTAL";
  const along = horizontal ? sizing.horizontal : sizing.vertical;
  const axis = horizontal ? WIDTH : HEIGHT;
  for (const part of parts.filter(keepsOwnSize)) {
    part.read(
      "flex",
      (value) => value,
      (written) => ({ outcome: "dropped", detail: noFlex(written) }),
      []
    );
  }
  const growing = parts.filter((part) => part.has("flex") && !keepsOwnSize(part));
  if (readContentShares(holder, growing, measured.itemsAtContent)) {
    return undefined;
  }
  const lone = loneGrowth(holder, parts, growing);
  if (lone !== undefined) {
    return lone;
  }
  const [only] = growing;
  if (!layout.flex || growing.length !== 1 || only === undefined) {
    return undefined;
  }
  const one = (value: string) => (normalizeCss(value) === "1" ? value : undefined);
  if (along.kind !== "hug") {
    if (only.has(axis.length) && !replacesAutomaticMinimum(only, axis)) {
      return undefined;
    }
    const fills = only.read(
      "flex",
      one,
      () => ({
        outcome: "literal",
        detail: `the one layer that grows fills the room the ${axis.flow}'s other layers leave`,
      }),
      only.feed("sizing")
    );
    return fills === undefined ? undefined : { kind: "fills", place: parts.indexOf(only), alone: false };
  }
  const centred = readCentredGrowth(holder, parts, measured.labelOnly, keepsOwnWidth);
  if (centred !== undefined) {
    return centred;
  }
  // A zero minimum never lengthens the box, and any other limit along the axis can. A maximum the
  // definition's measurement says the content stays under never limits the box at all.
  const capped = style.has(axis.max) && !(axis === HEIGHT && underMaxHeight !== undefined);
  // A least width the box takes from beside it, as `spannedWidth` gives one, leaves room past its layers too.
  const limited =
    capped ||
    (style.has(axis.min) && evaluateLength(style.resolved(axis.min) ?? "") !== 0) ||
    (horizontal && holder.limits.minWidth !== undefined);
  if (!limited) {
    only.read(
      "flex",
      one,
      () => ({
        outcome: "dropped",
        detail:
          style.has(axis.max) && underMaxHeight !== undefined
            ? `the ${axis.flow} hugs its layers under its max-height, ${underMaxHeight}, so the one layer that grows has no room to grow into`
            : `the ${axis.flow} hugs its layers, so the one layer that grows has no room to grow into`,
      }),
      []
    );
  }
  return undefined;
}

/** Why a lone layer's `flex-grow` draws as a fill. */
const LONE_GROWTH =
  "the row's one layer grows from its content into all the room the row has, and shrinks to it where its content is wider, which a fill takes";

/**
 * Read the `flex-grow` of a flex row's one layer, which sets no `flex` shorthand, basis, width,
 * width limit or margin across, since a margin takes room the fill would draw. A layer with a `flex` shorthand of its own, as `flex-none` sets, keeps the
 * shorthand's reading, so a `flex-grow` beside it stays unread. Its basis is its content (CSS Flexbox 1 §7.2.3). With no other layer to share the
 * room, a grow of 1 or more takes all the free space, and a shrink of 1 or more gives back all the
 * overflow; a factor below 1 takes or gives back only that share (§9.7). So the layer is as wide as
 * the row's content, as a fill is, down to its automatic minimum, its min-content width (§4.5),
 * which a fill does not keep, as with `flex: 1`. A width or limit of its own can take it past the
 * row or short of it, and a row that hugs has no free space, so each leaves the layer as it is. A
 * column's layer is not read here.
 *
 * @param holder - The row.
 * @param parts - The style of each part in the row's flow.
 * The fill draws the layer only where its least width fits the row in every mode, which the mapping
 * checks once the layer maps, as `fitsRoom` says.
 *
 * @param holder - The row.
 * @param parts - The style of each part in the row's flow.
 * @param growing - The parts that set a `flex` shorthand.
 * @returns The one part, where it fills; undefined otherwise.
 */
function loneGrowth(
  holder: Holder,
  parts: readonly LayerStyle[],
  growing: readonly LayerStyle[]
): Growth | undefined {
  const { layout, sizing, layers } = holder;
  const [lone] = parts;
  if (
    !layout.flex ||
    layout.direction !== "HORIZONTAL" ||
    growing.length > 0 ||
    layers.length !== 1 ||
    parts.length !== 1 ||
    lone === undefined ||
    sizing.horizontal.kind === "hug" ||
    lone.has("flex") ||
    lone.has("flex-basis") ||
    [WIDTH.length, WIDTH.min, WIDTH.max, "margin-left", "margin-right"].some((property) =>
      lone.has(property)
    ) ||
    (evaluateNumber(lone.resolved("flex-shrink") ?? "1") ?? 0) < 1
  ) {
    return undefined;
  }
  const grows = lone.read(
    "flex-grow",
    (value) => ((evaluateNumber(value) ?? 0) >= 1 ? value : undefined),
    () => ({ outcome: "literal", detail: LONE_GROWTH }),
    lone.feed("sizing")
  );
  return grows === undefined ? undefined : { kind: "fills", place: 0, alone: true };
}

/** What {@link readGrowth} reads besides the box and its parts' styles, as its `measured` says. */
type GrowthMeasure = {
  readonly underMaxHeight: string | undefined;
  readonly itemsAtContent: boolean;
  readonly labelOnly: readonly boolean[];
};

/**
 * Whether a growing layer sets its own minimum along its parent's direction, which replaces the
 * automatic minimum (CSS Flexbox 1 §4.5). The automatic minimum reads the layer's own length as its
 * specified size suggestion, so without a minimum of its own that length can still widen it.
 */
function replacesAutomaticMinimum(layer: LayerStyle, axis: AxisProperties): boolean {
  const minimum = layer.resolved(axis.min);
  return minimum !== undefined && normalizeCss(minimum) !== "auto";
}
