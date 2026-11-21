/**
 * The auto margins of a flex box's layers that the build reads as the box's alignment, as
 * `readFlow` in `box-flow.ts` takes them: one auto margin between two layers or after a row's
 * label (#773), an auto end margin on the first of a row's three or more parts (#824), an auto start
 * margin on the last of them (#802), and auto margins on all four sides of a column's one layer. Each reading carries the coverage note that
 * names it. Any other auto margin stays unread, so it lands unmapped.
 */
import type { FlowLayers } from "./box-flow";
import { setsMinimumWidth } from "./box-sizing";
import { evaluateNumber, normalizeCss } from "./css-values";
import type { DirectionSpec } from "./kit-spec";
import type { CoverageNote, Feed, LayerStyle } from "./layer-style";
import type { RestSide } from "./placement";

/**
 * How a flex box's auto margins place its layers: `spaced` and `label-fills` as {@link readAutoStart}
 * reads them, a frame around the rest of the row that packs its layers at its `restAt` side as
 * {@link readRest} reads it, and `centred` as {@link readCentredLone} reads it.
 */
export type AutoMarginPlacement =
  | { readonly kind: "spaced" }
  | { readonly kind: "label-fills" }
  | { readonly kind: "centred" }
  | { readonly kind: "rest"; readonly restAt: RestSide };

/**
 * What the capture and the mapping know of a flex box's line: its direction, whether the capture
 * measured it leaving room for the auto margins (`free`) and fitting its layers (`fits`) in every
 * mode, whether the box hugs its length along a row and its height, and how many of its parts sit
 * out of its flow.
 */
type FlexLine = {
  readonly direction: FlexDirection;
  readonly free: boolean;
  readonly fits: boolean;
  readonly hugsRow: boolean;
  readonly hugsHeight: boolean;
  readonly outOfFlow: number;
};

/**
 * Read the auto margins of a flex box's layers along its direction, and in a column, on all four
 * sides of its one layer.
 *
 * @param reader - The box's style.
 * @param flow - The box's layers in flow.
 * @param line - What the capture and the mapping know of the box's flex line.
 * @returns How the margins place the box's layers, or undefined where they stay unread.
 */
export function readAutoMargins(
  reader: LayerStyle,
  flow: FlowLayers,
  line: FlexLine
): AutoMarginPlacement | undefined {
  const between = readAutoStart(reader, flow, line);
  if (between !== undefined) {
    return { kind: between };
  }
  const rest = readRest(reader, flow, line);
  if (rest !== undefined) {
    return rest;
  }
  return line.direction === "VERTICAL" && readCentredLone(reader, flow, line.free)
    ? { kind: "centred" }
    : undefined;
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

/** How the coverage table names the auto margin {@link readRest} reads, on a row's first part or its last. */
const REST_DETAILS = {
  end: "the auto margin takes the row's free space after the first layer, which a frame around the layers after it fills, packing them at its end",
  start:
    "the auto margin takes the row's free space before the last layer, which a frame around the layers before it fills, packing them at its start",
} as const;

/** How the coverage table names the `justify-content` of a row whose auto margin {@link readRest} reads. */
const REST_JUSTIFY = {
  end: "the first layer's auto margin takes the row's free space before `justify-content` places the layers (CSS Flexbox 1 §8.1), so it has none to place",
  start:
    "the last layer's auto margin takes the row's free space before `justify-content` places the layers (CSS Flexbox 1 §8.1), so it has none to place",
} as const;

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
  line: FlexLine
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
  readMargin(reader, flow, between.style, between.property, reader.feed("primaryAlign"), {
    outcome: "literal",
    detail:
      placing === "label-fills"
        ? AUTO_START_AFTER_LABEL
        : direction === "VERTICAL"
          ? AUTO_START_DOWN
          : AUTO_START,
  });
  return placing;
}

/**
 * Read an auto end margin on the first of a flex row's three or more parts, or an auto start margin
 * on the last of them. Tour's footer sets Skip at its start by `me-auto` and Back and Next at its
 * end, and a Date range picker's field box sets its two inputs and their separator at its start and
 * the calendar trigger at its end by `ms-auto`. The margin takes the row's free space before
 * `justify-content` distributes it (CSS Flexbox 1 §8.1), so the parts on the margin's far side end
 * the row and the others start it, each group with the gap between its parts, whatever
 * `justify-content` the row sets. A Figma row cannot hold some layers at its start and others at its
 * end, so the box mapping draws the group of two or more in a frame that fills the rest of the row
 * and packs them at the frame's end or start, as `end-frame.ts` draws it. The row then packs its two
 * layers at its start with its gap. An auto end margin on the first part packs the frame's layers at
 * its `end`, and an auto start margin on the last part at its `start`.
 *
 * The capture must measure the row leaving the margin room in every mode (`freeAlongMain`), with its
 * items packed at its start, so the room is the same whatever `justify-content` the row sets: where
 * the parts and the gaps fill the row, the margin takes none and CSS keeps them where
 * `justify-content` places them, which the frame would not. A part that grows takes the free space
 * first (CSS Flexbox 1 §9.7), so that capture records no room either, unless a maximum caps it. The
 * part with the margin must not grow: capped, it takes the free space up to its cap before the
 * margin takes the rest, where a Figma layer that fills beside the filling frame splits the room with
 * it. The row must not hug its width,
 * which leaves no room to fill, hold its own label or icons, or hold a part out of its flow, which
 * would paint among the parts the frame moves. The part with the margin must show in every instance:
 * a BOOLEAN property that hides it takes its margin out of the row, so CSS places the others by
 * `justify-content`, where the frame keeps them packed. A row that hugs its height must leave each
 * part's `align-self` unset: a part that stretches there, or one that sets another alignment and so
 * lets the row stretch the rest, fills a frame that hugs only its own layers (PF), where CSS stretches
 * it to the row's tallest item. The part with the margin sets no margin on its other side, and the
 * other parts set no margin along the row, which the frame would drop. Any other shape leaves the
 * margin unread, so it lands unmapped.
 *
 * @param reader - The row's style.
 * @param flow - The row's layers in flow.
 * @param line - What the capture and the mapping know of the row's flex line.
 * @returns Which side of the frame its layers pack at, or undefined where the margin stays unread.
 */
function readRest(
  reader: LayerStyle,
  flow: FlowLayers,
  line: FlexLine
): { readonly kind: "rest"; readonly restAt: RestSide } | undefined {
  const { start, end } = MAIN_MARGINS.HORIZONTAL;
  const auto = (style: LayerStyle, property: string) =>
    normalizeCss(style.resolved(property) ?? "") === "auto";
  const first = flow.parts.at(0);
  const last = flow.parts.at(-1);
  const side =
    first !== undefined && auto(first.style, end) && !first.style.has(start)
      ? { margined: first, property: end, packs: "end" as const }
      : last !== undefined && auto(last.style, start) && !last.style.has(end)
        ? { margined: last, property: start, packs: "start" as const }
        : undefined;
  const applies =
    side !== undefined &&
    line.direction === "HORIZONTAL" &&
    line.free &&
    !line.hugsRow &&
    line.outOfFlow === 0 &&
    flow.others.length === 0 &&
    flow.parts.length >= 3 &&
    !side.margined.optional &&
    !mayGrow(side.margined.style) &&
    flow.parts.every(
      ({ style }) => style === side.margined.style || (!style.has(start) && !style.has(end))
    ) &&
    (!line.hugsHeight || flow.parts.every(({ style }) => selfAlignOf(style) === "auto"));
  if (!applies) {
    return undefined;
  }
  // The frame regroups the row's layers, which an inner root built in place must carry too.
  readMargin(
    reader,
    flow,
    side.margined.style,
    side.property,
    [...reader.feed("primaryAlign"), ...reader.feed("layers")],
    {
      outcome: "literal",
      detail: REST_DETAILS[side.packs],
    }
  );
  reader.read(
    "justify-content",
    (value) => value,
    () => ({ outcome: "dropped", detail: REST_JUSTIFY[side.packs] }),
    []
  );
  return { kind: "rest", restAt: side.packs };
}

/**
 * Read a layer's auto margin along a flex box, which fills the box's fields that place its layers,
 * the box's alignment and, where a frame regroups them, its layers. On an instance part the
 * read fills `around` too, what the composite draws around the instance, as `margin-box.ts` feeds a
 * margin frame around one: the instance's inner root takes the read's fields at its own key paths,
 * which the box's fields do not have, since the box holds the instance. The inner root built in place
 * that draws the box, if any, must still carry the box's fields, as `settle` in `instance-parts.ts`
 * says.
 *
 * @param reader - The box's style.
 * @param flow - The box's layers in flow.
 * @param margined - The style of the layer whose auto margin the box reads.
 * @param property - The margin.
 * @param feed - The box's fields the margin fills.
 * @param note - What the margin became, for the coverage table.
 */
function readMargin(
  reader: LayerStyle,
  flow: FlowLayers,
  margined: LayerStyle,
  property: string,
  feed: Feed,
  note: CoverageNote
): void {
  if (flow.parts.some(({ style, instance }) => instance && style === margined)) {
    reader.readAround(
      margined,
      property,
      (value) => value,
      () => note,
      feed
    );
  } else {
    margined.read(
      property,
      (value) => value,
      () => note,
      feed
    );
  }
}

/**
 * Whether a flex item may grow: the declaration that wins its `flex-grow` sets a grow factor that is
 * not zero, or one the build cannot read. The `flex` shorthand counts only where it wins the
 * longhand, so a `grow-0` after `flex-auto` keeps the item from growing.
 *
 * @param style - The item's style.
 * @returns True unless the winning declaration leaves the factor at zero.
 */
function mayGrow(style: LayerStyle): boolean {
  if (style.winnerOf("flex-grow") === "flex") {
    const flex = style.resolved("flex");
    return flex === undefined || flexGrowOf(flex) !== 0;
  }
  return evaluateNumber(style.resolved("flex-grow") ?? "0") !== 0;
}

/**
 * The grow factor a `flex` value sets (CSS Flexbox 1 §7.2): 0 for `none` and `initial`, else its one
 * unitless number, and 1 where it gives only a basis, as `auto` and `10px` do, since the shorthand
 * sets an omitted grow factor to 1. A value with a function or a CSS-wide keyword reads as none.
 *
 * @param value - The `flex` value.
 * @returns The grow factor, or undefined where the value does not read as one.
 */
function flexGrowOf(value: string): number | undefined {
  const flex = normalizeCss(value);
  if (flex === "none" || flex === "initial") {
    return 0;
  }
  if (flex.includes("(") || CSS_WIDE.has(flex)) {
    return undefined;
  }
  const grow = flex.split(/\s+/).find((token) => UNITLESS.test(token));
  return grow === undefined ? 1 : Number(grow);
}

/** The CSS-wide keywords, whose `flex` the cascade around the item sets. */
const CSS_WIDE: ReadonlySet<string> = new Set(["inherit", "unset", "revert", "revert-layer"]);

/** A unitless CSS number, as a grow or shrink factor is written. */
const UNITLESS = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/**
 * A part's `align-self`, `auto` where it sets none.
 *
 * @param style - The part's style.
 * @returns The normalized value.
 */
function selfAlignOf(style: LayerStyle): string {
  return normalizeCss(style.resolved("align-self") ?? "auto");
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
