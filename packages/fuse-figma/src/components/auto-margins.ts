/**
 * The auto margins of a flex box's layers that the build reads as the box's alignment, as
 * `readFlow` in `box-flow.ts` takes them: one auto margin between two layers or after a row's
 * label (#773), and auto margins on all four sides of a column's one layer. Each reading carries the
 * coverage note that names it. Any other auto margin stays unread, so it lands unmapped.
 */
import type { FlowLayers } from "./box-flow";
import { setsMinimumWidth } from "./box-sizing";
import { normalizeCss } from "./css-values";
import type { DirectionSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";

/**
 * How a flex box's auto margins place its layers: `spaced` and `label-fills` as {@link readAutoStart}
 * reads them, and `centred` as {@link readCentredLone} reads it.
 */
export type AutoMarginPlacement = "spaced" | "label-fills" | "centred";

/**
 * Read the auto margins of a flex box's layers along its direction, and in a column, on all four
 * sides of its one layer.
 *
 * @param reader - The box's style.
 * @param flow - The box's layers in flow.
 * @param line - The box's direction, and whether the capture measured its flex line leaving room for
 *   the margins (`free`) and fitting its layers (`fits`) in every mode.
 * @returns How the margins place the box's layers, or undefined where they stay unread.
 */
export function readAutoMargins(
  reader: LayerStyle,
  flow: FlowLayers,
  line: { readonly direction: FlexDirection; readonly free: boolean; readonly fits: boolean }
): AutoMarginPlacement | undefined {
  const between = readAutoStart(reader, flow, line);
  if (between !== undefined) {
    return between;
  }
  return line.direction === "VERTICAL" && readCentredLone(reader, flow, line.free) ? "centred" : undefined;
}

/** How the coverage table names an auto margin {@link readAutoStart} reads between two layers. */
const AUTO_START =
  "the auto margin takes the row's free space, which ends the row with the layer, as space-between places two layers";

/** How the coverage table names an auto margin {@link readAutoStart} reads between a column's two layers. */
const AUTO_START_DOWN =
  "the auto margin takes the column's free space, which ends the column with the last layer, as space-between places two layers";

/** How the coverage table names an auto start margin {@link readAutoStart} reads after the label. */
const AUTO_START_AFTER_LABEL =
  "the auto margin takes the row's free space after the label, which fills that space in Figma and paints nothing past its text, so the layer ends the row";

/** The `text-align` values that set a label's text from its left, where a filling label draws as one at its own width. */
const FROM_LEFT: ReadonlySet<string> = new Set(["", "start", "left"]);

/** The margins before and after a layer along a flex box's direction. */
const MAIN_MARGINS = {
  HORIZONTAL: { start: "margin-left", end: "margin-right" },
  VERTICAL: { start: "margin-top", end: "margin-bottom" },
} as const satisfies Record<FlexDirection, { readonly start: string; readonly end: string }>;

/** The directions of a flex box, whose auto margins share its free space along it. */
export type FlexDirection = Exclude<DirectionSpec, "GRID">;

/**
 * Read an auto margin between the layers of a flex box along its direction, as a menu row's shortcut
 * or caret ends the row and a Sheet's `mt-auto` footer ends its column. Auto margins take the box's
 * free space before `justify-content` distributes it (CSS Flexbox 1 §8.1), so the margin ends the
 * box with the layers after it and packs the others at the start. The box must leave
 * `justify-content` unset, so nothing else places them.
 *
 * - Between two layers, an auto start margin on the last that sets no end margin reads as spaced
 *   between the box's ends, as `space-between` places two layers: `spaced`. So does an auto end
 *   margin on the first part that sets no start margin, as `me-auto` writes it.
 * - In a row, an auto start margin on the last of more layers, with the row's own label right before
 *   it and the row setting its text from the left, makes the label fill the free space in Figma,
 *   where it paints nothing past its text, so the row packs at its start with its gap and draws what
 *   CSS draws: `label-fills`. The layers before the label keep their widths.
 *
 * The two readings need different proofs, which the capture measures in every mode (#773):
 *
 * - `spaced` needs the box to leave the margin room (`freeAlongMain`): where the layers and the gap
 *   fill or overflow the box, the margin takes none, and the box keeps them packed at its start with
 *   the gap, where `space-between` would not. A row whose first layer is its own label, which a TEXT
 *   property sets, draws the label filling the room the last layer leaves, whatever the sample's
 *   word count, as `spacedFirst` in `label-layout.ts` says, so a longer label wraps between words
 *   there as CSS wraps it. The capture measures the room on the sample text. One word wider than the
 *   room is a known limit, as for `label-fills` below.
 * - `label-fills` needs only the row to fit its layers (`fitsAlongMain`). The margin takes whatever
 *   free space there is, or a label that grows takes it first (CSS Flexbox 1 §9.7 before §8.1), and a
 *   filling label takes the same in Figma, so the two draw alike at any free space of zero or more.
 *   Where the layers overflow, CSS stops the label at its min-content width and Figma shrinks it.
 *   The capture measures the fact on the demo's sample text, and the label is a TEXT property a
 *   designer types into. A longer label of several words still draws alike while the last layer's
 *   text holds no space, as a menu shortcut's keys do: that layer cannot shrink below its own width,
 *   so CSS and Figma both break the label between words inside the room. A word wider than the room
 *   is a known limit. CSS keeps the word whole at its min-content width and pushes the last layer
 *   past the row's end (CSS Flexbox 1 §4.5), while the filling Figma text breaks the word inside the
 *   room.
 *
 * A row that leaves no free space, as one that hugs its layers along its direction or holds a layer
 * that grows, gives the margin nothing to take, and draws the same packed at its start, which the
 * mapping decides once its layers map, as `spacesNothingOut` in `box-mapping.ts` says. An auto margin
 * anywhere else stays unread, so it lands unmapped.
 *
 * @param reader - The box's style.
 * @param flow - The box's layers in flow.
 * @param line - The box's direction, and whether the capture measured its flex line leaving the
 *   margin room (`free`) and fitting its layers (`fits`) in every mode.
 * @returns How the margin places the box's layers, or undefined where it stays unread.
 */
function readAutoStart(
  reader: LayerStyle,
  flow: FlowLayers,
  line: { readonly direction: FlexDirection; readonly free: boolean; readonly fits: boolean }
): "spaced" | "label-fills" | undefined {
  const { direction, free, fits } = line;
  const { start, end } = MAIN_MARGINS[direction];
  const auto = (style: LayerStyle | undefined, property: string) =>
    normalizeCss(style?.resolved(property) ?? "") === "auto";
  const count = flow.parts.length + flow.others.length;
  const [first] = flow.parts;
  const labelFills =
    direction === "HORIZONTAL" &&
    count > 2 &&
    flow.labelBeforeLast &&
    FROM_LEFT.has(normalizeCss(reader.resolved("text-align") ?? ""));
  // Two layers spaced to the ends need the room the margin takes; a label that fills before the last
  // layer needs only the row to fit, as the doc above says.
  const proven = count === 2 ? free : labelFills && fits;
  // `me-auto` on the first of two parts places them as `ms-auto` on the second does.
  const between =
    proven && auto(flow.last, start) && flow.last?.has(end) !== true
      ? { style: flow.last, property: start }
      : free &&
          count === 2 &&
          flow.others.length === 0 &&
          auto(first?.style, end) &&
          first?.style.has(start) !== true
        ? { style: first?.style, property: end }
        : undefined;
  const placing =
    count === 2 ? "spaced" : between?.property === start && labelFills ? "label-fills" : undefined;
  if (between?.style === undefined || placing === undefined || reader.has("justify-content")) {
    return undefined;
  }
  between.style.read(
    between.property,
    (value) => value,
    () => ({
      outcome: "literal",
      detail:
        placing === "label-fills"
          ? AUTO_START_AFTER_LABEL
          : direction === "VERTICAL"
            ? AUTO_START_DOWN
            : AUTO_START,
    }),
    reader.feed("primaryAlign")
  );
  return placing;
}

/** The `text-wrap-mode` values that let a text wrap, unset among them, which `white-space` also sets. */
const WRAPS: ReadonlySet<string> = new Set(["", "wrap"]);

/** The four margins of a box, which `m-auto` sets to `auto` together. */
const FOUR_MARGINS = ["margin-top", "margin-bottom", "margin-left", "margin-right"] as const;

/** How the coverage table names the auto margins {@link readCentredLone} reads, by the axis they share. */
const CENTRED_DETAILS = {
  primary:
    "the auto margins above and below share the column's free space, which centres the column's one layer down it",
  counter:
    "the auto margins left and right share the room across, which centres the column's one layer across it, at its own width up to the column's",
} as const;

/**
 * Read `auto` margins on all four sides of a flex column's one layer, as List detail's empty pane
 * centres its `m-auto` text. Auto margins take the free space along the column before
 * `justify-content` does (CSS Flexbox 1 §8.1). Auto margins across stop the stretch, so the layer
 * keeps its fit-content width and the margins share the room left beside it (§9.4 step 11, §9.6
 * step 13). The layer sits in the middle on both axes, which a Figma column centred on both axes
 * draws, with the layer at its own width up to the column's content width, as `roomInside` in
 * `box-sizing.ts` gives it.
 *
 * The capture must measure the column leaving room along it in every mode (`freeAlongMain`). A layer
 * that overflows the column takes zero margins and sits at its start, where Figma's centre would
 * overflow both ends. Across, the margins take zero for the same reason (CSS Flexbox 1 §8.1), so the
 * layer must not grow past the column's content width there either. A layer that shows only its own
 * text, which wraps, with no `width` and no `min-width` above zero, is no wider than its text up to
 * the column's content width, and the width cap `roomInside` in `box-sizing.ts` gives it wraps the
 * text at that width as CSS does. One word wider than the column is a known limit: CSS keeps the word
 * whole and starts the layer at the column's left, while Figma breaks the word inside the cap. A layer
 * that sets its width or minimum width, holds an icon or a layer, or keeps its text on one line can
 * be wider than the column, so its margins stay unread. The column must set no `justify-content` or
 * `align-items`, so nothing else places the layer. Any other shape leaves the margins unread, so they
 * land unmapped.
 *
 * @param reader - The column's style.
 * @param flow - The column's layers in flow.
 * @param free - Whether the capture measured the column leaving room along it in every mode.
 * @returns True where the column's one layer sits centred by its auto margins.
 */
function readCentredLone(reader: LayerStyle, flow: FlowLayers, free: boolean): boolean {
  const [only, ...rest] = flow.parts;
  const lone =
    only !== undefined &&
    rest.length === 0 &&
    flow.others.length === 0 &&
    FOUR_MARGINS.every((property) => normalizeCss(only.style.resolved(property) ?? "") === "auto");
  if (!free || !lone || reader.has("justify-content") || reader.has("align-items")) {
    return false;
  }
  const bounded =
    only.onlyText &&
    normalizeCss(only.style.resolved("width") ?? "auto") === "auto" &&
    !setsMinimumWidth(only.style) &&
    WRAPS.has(normalizeCss(only.style.resolved("text-wrap-mode") ?? ""));
  if (!bounded) {
    return false;
  }
  for (const property of FOUR_MARGINS) {
    const axis = property === "margin-top" || property === "margin-bottom" ? "primary" : "counter";
    only.style.read(
      property,
      (value) => value,
      () => ({ outcome: "literal", detail: CENTRED_DETAILS[axis] }),
      reader.feed(axis === "primary" ? "primaryAlign" : "counterAlign")
    );
  }
  return true;
}
