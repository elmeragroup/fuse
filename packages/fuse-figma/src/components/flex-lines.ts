/**
 * How a horizontal flex row that may wrap draws its lines: as a Figma row on one line, as a Figma
 * WRAP row, or as neither. The decision and the reads of `flex-wrap` and the gaps it rests on live
 * here, so the one-line rules and the WRAP rule read the same facts in the same order.
 *
 * A row that wraps breaks a line only where its items overflow it (CSS Flexbox 1 §9.3). A row the
 * capture measured on one line draws as a Figma row, which never wraps. A row the capture measured
 * on two or more lines draws as a Figma WRAP row only where Figma's WRAP layout of its layers, as the
 * build draws them, sets each layer where CSS set it in every layout the capture kept
 * (`figma-wrap-layout.ts`, from the live probes WR1 to WR9). Every other row that breaks a line keeps
 * its `flex-wrap` and gaps unmapped, each with the reason it refuses, and never drops them as a row
 * on one line.
 */
import { flexLinesOutcome } from "../capture/capture-format";
import type {
  FlexLineLayout,
  FlexLineLayouts,
  FlexLinesFact,
  FlexLinesRefusal,
} from "../capture/capture-format";
import { LAYOUT_UNIT_PX } from "../capture/page-clearances";
import { hugsUncapped } from "./box-sizing";
import type { Holder } from "./box-sizing";
import { describeNumber, normalizeCss, readNumber, splitTopLevel } from "./css-values";
import type { ModeView, VariableIndex } from "./css-values";
import { layOutWrap } from "./figma-wrap-layout";
import type { WrapLayer, WrapPlace, WrapRow, WrapWidth } from "./figma-wrap-layout";
import type { BoxSpec, ChildLayerSpec, NumberSpec, SizeSpec } from "./kit-spec";
import { outOfLayout, strokeRoom, ZERO } from "./kit-spec";
import type { Feed, LayerStyle } from "./layer-style";

/**
 * How a row draws its lines.
 *
 * - `Unwrapped`: the box is no horizontal flex row, so no rule here reads its `flex-wrap`.
 * - `MeasuredOneLine`: the capture measured the row on one line in every mode, at a fixed height, as
 *   {@link ONE_FLEX_LINE} says, so it lays its layers out as a row that does not wrap, and drops
 *   `flex-wrap` for the reason `detail` gives.
 * - `OneLine`: the row breaks no line for the reason `detail` gives, so it drops `flex-wrap`.
 * - `Undecided`: nothing tells whether the row breaks a line, so its `flex-wrap` stays unread.
 * - `Candidate`: the capture measured the row's lines filling it in every mode and nothing the
 *   WRAP layout cannot place refuses it, so {@link settleWrap} holds its layers, once mapped, to
 *   each kept `layout` to decide between `Wraps` and `Refused`.
 * - `Wraps`: the row draws with `layoutWrap` WRAP, its lines `lineGap` apart and its layers
 *   `itemSpacing` apart.
 * - `Refused`: the capture measured the row on two or more lines, and `reason` says why no Figma row
 *   draws them, so its `flex-wrap` and gaps stay unmapped.
 */
export type FlexLines =
  | { readonly _tag: "Unwrapped" }
  | { readonly _tag: "MeasuredOneLine"; readonly detail: string }
  | { readonly _tag: "OneLine"; readonly detail: string }
  | { readonly _tag: "Undecided" }
  | {
      readonly _tag: "Candidate";
      readonly gaps: LineGaps;
      readonly layouts: FlexLineLayouts;
    }
  | { readonly _tag: "Wraps"; readonly gaps: LineGaps }
  | { readonly _tag: "Refused"; readonly reason: string };

/** How a row draws its lines once {@link settleWrap} decides a candidate. */
export type SettledLines = Exclude<FlexLines, { readonly _tag: "Candidate" }>;

/** What the capture measured of a row's lines, which {@link flexLinesOf} decides from. */
export type MeasuredLines = {
  /** Whether the capture measured the row on one line in every mode, `oneFlexLine`. */
  readonly oneFlexLine: boolean;
  /** What the capture measured of a row that breaks a line in some mode, `flexLines`. */
  readonly flexLines: FlexLinesFact | undefined;
  /** The definition's measurement that the row's layers fit on one line in every cell, if any. */
  readonly fitsOneLine: string | undefined;
};

/**
 * Where a row's gaps come from: for each axis, the declaration that wins it and its value for that
 * axis, or none where no declaration sets it and it is 0.
 */
type GapSource = { readonly property: string; readonly value: string } | undefined;

/** The gaps a WRAP row draws: between its lines and between the layers of a line. */
export type LineGaps = {
  readonly lineGap: NumberSpec;
  readonly itemSpacing: NumberSpec;
  readonly row: GapSource;
  readonly column: GapSource;
};

/** How the coverage table names a `flex-wrap` that a row measured on one line drops. */
const ONE_FLEX_LINE =
  "the capture measured the row's items on one line in every mode, where forcing nowrap moves none of them, so CSS collects them into one line (CSS Flexbox 1 §9.3 step 1) and align-content stretches it to the row's height (§9.4), as a row that does not wrap lays them out, and a Figma row never wraps";

/** How the coverage table names a `flex-wrap` that a WRAP row reads. */
const WRAPS_INTO_LINES =
  "the capture measured the row's items on two or more lines in every mode, each break kept a pixel either side, no item shrunk on its line and the lines filling the row's height, and Figma's WRAP layout of the row's layers as the build draws them sets each where CSS does in every mode, so the row draws with layoutWrap WRAP (WR1 to WR9)";

/** The `align-content` values that stretch a wrapping row's lines to its height, `normal` among them (CSS Box Alignment 3 §5.1). */
const STRETCHES_LINES: ReadonlySet<string> = new Set(["", "normal", "stretch"]);

/**
 * How far apart, in CSS pixels, a layer's edge in the WRAP layout and the item's edge Chromium
 * measured may sit: three of Chromium's layout units. Chromium sets each box on a 64th of a pixel,
 * while the layout's equal shares of a line fall between them.
 */
const LAYOUT_TOLERANCE_PX = 3 * LAYOUT_UNIT_PX;

/** The coverage note of each measurement of a row on two or more lines that refuses a WRAP row. */
const MEASURED_REFUSALS = {
  "some-modes":
    "the capture measured the row's items on two or more lines in some modes only, or found it wrapping in some modes only, and the kit draws one layout for every mode, so no Figma row breaks its lines alike",
  unread:
    "the capture could not read the row's lines as a Figma row draws them, since an item is a run of text, has no height or no box the page reads, or has a margin, an order or a transform, so nothing tells whether the row breaks a line, or whether a Figma WRAP row breaks it alike",
  shrinks:
    "the capture measured an item narrower on its line than its flex base size, which CSS shrinks it from (CSS Flexbox 1 §9.7), while a Figma WRAP row draws each layer at its own width and lets a wider one overflow its line (WR2)",
  "tight-break":
    "the capture measured a line break that moves with the row a pixel wider or narrower, so a font or a rounding that moves an item breaks the lines apart in CSS and in Figma",
  "spare-height":
    "the capture measured the lines leaving part of the row's height over, with no item stretched, which align-content: normal stretches them into in CSS (CSS Flexbox 1 §9.4) and a Figma WRAP row does not (WR4)",
} as const satisfies Readonly<Record<FlexLinesRefusal, string>>;

/**
 * Decide how a row draws its lines, short of the WRAP layout. A row the capture measured on two or
 * more lines is a {@link settleWrap} candidate where all of these hold, and refuses with the first
 * that does not:
 *
 * - the capture measured the lines filling the row in every mode (`fills`), so their breaks keep a
 *   pixel either side, no item shrinks, and no line stretches;
 * - its `flex-wrap` is a plain `wrap`, and it sets no `direction: rtl` or vertical `writing-mode`,
 *   which start its lines from another edge than the WRAP layout does;
 * - each gap is one length or synced variable, read from the declaration that wins its axis.
 *
 * A row measured on no more than one line keeps the rules of a row that does not wrap, each naming
 * why it breaks no line: a layer that grows, which takes what the others leave, a row that hugs its
 * layers with nothing bounding its width, {@link ONE_FLEX_LINE} for one measured on one line at a
 * fixed height, and the definition's measurement that its layers fit one line.
 *
 * @param holder - The box.
 * @param measured - What the capture measured of the row's lines.
 * @param growing - Whether one of the row's layers grows, as `readGrowth` found it.
 * @param variables - The synced variables.
 * @returns How the row draws its lines, or a candidate for {@link settleWrap}.
 */
export function flexLinesOf(
  holder: Holder,
  measured: MeasuredLines,
  growing: boolean,
  variables: VariableIndex
): FlexLines {
  const { style, layout, sizing } = holder;
  if (!layout.flex || layout.direction !== "HORIZONTAL") {
    return { _tag: "Unwrapped" };
  }
  const wraps = normalizeCss(style.resolved("flex-wrap") ?? "") === "wrap";
  const alignContent = normalizeCss(style.resolved("align-content") ?? "");
  if (measured.flexLines !== undefined) {
    const outcome = flexLinesOutcome(measured.flexLines);
    if (outcome._tag === "Refusal") {
      return { _tag: "Refused", reason: MEASURED_REFUSALS[outcome.refusal] };
    }
    const refusal = startRefusal(style, wraps);
    if (refusal !== undefined) {
      return { _tag: "Refused", reason: refusal };
    }
    const gaps = gapsOf(style, variables);
    return gaps._tag === "Refused" ? gaps : { _tag: "Candidate", gaps: gaps.gaps, layouts: outcome.layouts };
  }
  const oneLine =
    measured.oneFlexLine && sizing.vertical.kind === "fixed" && wraps && STRETCHES_LINES.has(alignContent);
  const detail = growing
    ? "the one layer that grows takes what the row's other layers leave, so the row breaks no line until they overflow it, and a Figma row never wraps"
    : hugsUncapped(holder)
      ? "the row hugs its layers and nothing bounds the width CSS gives it, so it never runs out of room to break a line, and a Figma row never wraps"
      : oneLine
        ? ONE_FLEX_LINE
        : measured.fitsOneLine;
  if (detail === undefined) {
    return { _tag: "Undecided" };
  }
  return oneLine ? { _tag: "MeasuredOneLine", detail } : { _tag: "OneLine", detail };
}

/**
 * Why a row the capture measured on lines that fill it lays them out from another edge than the WRAP
 * layout does, or undefined where it lays them out from the top left: a `flex-wrap` other than a plain
 * `wrap`, which stacks its lines from the bottom, `direction: rtl`, which starts each line at the
 * right (CSS Flexbox 1 §5.1), or a vertical `writing-mode`.
 */
function startRefusal(style: LayerStyle, wraps: boolean): string | undefined {
  if (!wraps) {
    return "the row's flex-wrap is no plain wrap, whose lines no probe shows a Figma WRAP row laying out";
  }
  const direction = normalizeCss(style.resolved("direction") ?? "ltr");
  if (direction !== "ltr") {
    return `direction: ${direction} starts each line at the row's right, where a Figma WRAP row starts it at the left (WR1)`;
  }
  const writing = normalizeCss(style.resolved("writing-mode") ?? "horizontal-tb");
  return writing === "horizontal-tb"
    ? undefined
    : `writing-mode: ${writing} runs the row's lines down the page, where a Figma WRAP row runs them across it (WR1)`;
}

/**
 * The declaration that wins a gap axis and its value for that axis, from `gap`, which sets both, or
 * from the axis's own longhand. A `gap` of two values sets the row gap first.
 */
function gapSource(style: LayerStyle, longhand: "row-gap" | "column-gap"): GapSource {
  const property = style.winnerOf(longhand);
  const value = property === undefined ? undefined : style.resolved(property);
  if (property === undefined || value === undefined) {
    return undefined;
  }
  if (property !== "gap") {
    return { property, value };
  }
  const [row = value, column = row] = splitTopLevel(normalizeCss(value), " ");
  return { property, value: longhand === "row-gap" ? row : column };
}

/**
 * A row's gaps as a WRAP row draws them, each from the declaration that wins its axis, or refused
 * where they draw as no Figma spacing: a percentage, which resolves against the row's content box,
 * its height for `row-gap` and its width for `column-gap` (CSS Box Alignment 3 §8.1), and which no
 * Figma spacing follows, a value that maps to no number, or a `gap` of two values, which one
 * declaration's coverage row cannot map to two fields.
 */
function gapsOf(
  style: LayerStyle,
  variables: VariableIndex
):
  | { readonly _tag: "Gaps"; readonly gaps: LineGaps }
  | { readonly _tag: "Refused"; readonly reason: string } {
  const row = gapSource(style, "row-gap");
  const column = gapSource(style, "column-gap");
  if (row?.property === "gap" && column?.property === "gap" && row.value !== column.value) {
    return {
      _tag: "Refused",
      reason: `the row's gap sets two values, ${row.value} between lines and ${column.value} between layers, which the build reads as no single Figma spacing`,
    };
  }
  const numbers: NumberSpec[] = [];
  for (const [source, side] of [
    [row, "height"],
    [column, "width"],
  ] as const) {
    if (source === undefined) {
      numbers.push(ZERO);
      continue;
    }
    if (source.value.includes("%")) {
      return {
        _tag: "Refused",
        reason: `the row's ${source.property} of ${source.value} is a share of the row's ${side}, which no Figma spacing follows`,
      };
    }
    const number = readNumber(source.value, variables);
    if (number === undefined) {
      return {
        _tag: "Refused",
        reason: `no Figma field reads the row's ${source.property} of ${source.value}`,
      };
    }
    numbers.push(number);
  }
  const [lineGap = ZERO, itemSpacing = ZERO] = numbers;
  return { _tag: "Gaps", gaps: { lineGap, itemSpacing, row, column } };
}

/**
 * The pixels a length draws in one density, or undefined where the build cannot tell: a literal's
 * value, or the one value a variable holds in that density's mode, or in every mode.
 */
export type DensityLengths = (density: string) => (length: NumberSpec) => number | undefined;

/**
 * Read lengths in each density through the synced variables and the modes of `Fuse density`, as
 * the build resolves them there.
 *
 * @param variables - The synced variables, whose bounds span every mode.
 * @param modes - Each mode of the synced collections.
 * @returns The reader.
 */
export function densityLengthsOf(variables: VariableIndex, modes: readonly ModeView[]): DensityLengths {
  return (density) => {
    const view = modes.find(({ name }) => name.toLowerCase() === `fuse density / ${density.toLowerCase()}`);
    return (length) => {
      if (length.kind === "literal") {
        return length.value;
      }
      for (const index of [view?.variables, variables]) {
        const least = index?.minimum(length.variable);
        if (least !== undefined && least === index?.maximum(length.variable)) {
          return least;
        }
      }
      return undefined;
    };
  };
}

/** The row a candidate draws, as the build maps it, which {@link settleWrap} lays out. */
export type WrapDraft = Pick<
  BoxSpec,
  "sizing" | "paddingLeft" | "paddingRight" | "stroke" | "counterAlign" | "primaryAlign" | "children"
>;

/**
 * Settle a WRAP candidate: lay its layers out as a Figma WRAP row does (`figma-wrap-layout.ts`), in
 * each layout the capture kept, from the layers as the build draws them, and draw it WRAP only where
 * each layer sits where CSS set its item, within {@link LAYOUT_TOLERANCE_PX}. Each layout's lengths
 * resolve in its density. A fixed layer takes its own width, a hugging one the width CSS gives it at
 * `flex: 0 0 auto`, which neither grows nor shrinks it, and a filling one breaks its line at its
 * `minWidth`. A fixed row's room is its width less its padding and stroke, and any other row's is the
 * content width CSS gave it. The row refuses with the first layer and mode that sit apart, or with a
 * layer the layout cannot place: a text, a hidden frame, a filling one with no `minWidth` or that
 * fills across its line, and a length no density resolves.
 *
 * @param candidate - The candidate.
 * @param row - The row as the build maps it.
 * @param lengths - How lengths resolve in each density.
 * @returns The row drawn WRAP, or refused with the reason.
 */
export function settleWrap(
  candidate: Extract<FlexLines, { readonly _tag: "Candidate" }>,
  row: WrapDraft,
  lengths: DensityLengths
): Extract<SettledLines, { readonly _tag: "Wraps" | "Refused" }> {
  if (row.primaryAlign !== "MIN") {
    return {
      _tag: "Refused",
      reason: `the row places its layers ${row.primaryAlign} along each line, where every probe packed a WRAP row's lines at their start (WR1 to WR6)`,
    };
  }
  const layers = row.children.filter((layer) => !outOfLayout(layer));
  for (const layout of candidate.layouts) {
    const input = wrapRow(candidate.gaps, row, layers, layout, lengths(layout.density));
    const mismatch = input._tag === "Unplaceable" ? input.reason : firstApart(layOutWrap(input.row), layout);
    if (mismatch !== undefined) {
      return { _tag: "Refused", reason: `${mismatch} in the mode ${layout.mode}` };
    }
  }
  return { _tag: "Wraps", gaps: candidate.gaps };
}

/** Why the WRAP layout cannot place a row or a layer. */
type Unplaceable = { readonly _tag: "Unplaceable"; readonly reason: string };

/** A row or a layer the WRAP layout cannot place, for the reason given. */
const unplaceable = (reason: string): Unplaceable => ({ _tag: "Unplaceable", reason });

/**
 * The WRAP layout's input for one kept layout, its lengths resolved in the layout's density, or why
 * the layout cannot place the row.
 */
function wrapRow(
  gaps: LineGaps,
  row: WrapDraft,
  layers: readonly ChildLayerSpec[],
  layout: FlexLineLayout,
  resolve: (length: NumberSpec) => number | undefined
): { readonly _tag: "Row"; readonly row: WrapRow } | Unplaceable {
  if (layers.length !== layout.items.length) {
    return unplaceable(
      `the row draws ${String(layers.length)} layers in its auto layout where CSS laid out ${String(layout.items.length)} items`
    );
  }
  // The first length no density resolves, which refuses the row once the input is read.
  let unresolved: string | undefined;
  const px = (length: NumberSpec): number => {
    const value = resolve(length);
    if (value === undefined) {
      unresolved ??= `the build cannot tell the pixels ${length.kind === "variable" ? length.variable.name : "a length"} draws in ${layout.density}`;
      return Number.NaN;
    }
    return value;
  };
  const room =
    row.sizing.horizontal.kind === "fixed"
      ? px(row.sizing.horizontal.length) -
        px(row.paddingLeft) -
        px(row.paddingRight) -
        px(strokeRoom(row.stroke, "left")) -
        px(strokeRoom(row.stroke, "right"))
      : layout.width;
  const placed: WrapLayer[] = [];
  for (const [index, layer] of layers.entries()) {
    const item = layout.items[index];
    const extent =
      item === undefined ? unplaceable(`CSS laid out no item for ${layer.key}`) : extentOf(layer, item, px);
    if (extent._tag === "Unplaceable") {
      return extent;
    }
    placed.push({ key: layer.key, width: extent.width, height: extent.height });
  }
  const itemSpacing = px(gaps.itemSpacing);
  const lineGap = px(gaps.lineGap);
  return unresolved === undefined
    ? { _tag: "Row", row: { room, itemSpacing, lineGap, counterAlign: row.counterAlign, layers: placed } }
    : unplaceable(unresolved);
}

/**
 * How wide and how tall a layer draws in a WRAP line, from its sizing and the item CSS laid out, or
 * why the layout cannot place it.
 */
function extentOf(
  layer: ChildLayerSpec,
  item: FlexLineLayout["items"][number],
  px: (length: NumberSpec) => number
): ({ readonly _tag: "Extent" } & Pick<WrapLayer, "width" | "height">) | Unplaceable {
  switch (layer.kind) {
    case "text":
      return unplaceable(`${layer.key} is a text, which no probe set in a WRAP line`);
    case "icon":
      return { _tag: "Extent", width: { kind: "fixed", width: px(layer.size) }, height: px(layer.size) };
    case "frame":
    case "instance": {
      if (layer.kind === "frame" && layer.hidden === true) {
        return unplaceable(
          `${layer.key} draws hidden, which takes no room in a Figma auto layout where CSS keeps its room`
        );
      }
      const { horizontal, vertical } = layer.sizing;
      if (vertical.kind === "fill" || vertical.kind === "placed") {
        return unplaceable(`${layer.key} fills across its line, which no probe read in a WRAP row`);
      }
      const minWidth = layer.kind === "frame" ? layer.limits.minWidth : layer.minWidth;
      const width = widthOf(layer.key, horizontal, item.own, minWidth, px);
      return width._tag === "Unplaceable"
        ? width
        : {
            _tag: "Extent",
            width: width.width,
            height: vertical.kind === "fixed" ? px(vertical.length) : item.height,
          };
    }
  }
}

/**
 * How a layer is wide in a WRAP line: its fixed width, its own width where it hugs, or filling above
 * its `minWidth`, or why the layout cannot place it: a filling layer with no `minWidth`, or one whose
 * width its placement leaves to the plugin.
 */
function widthOf(
  key: string,
  size: SizeSpec,
  own: number,
  minWidth: NumberSpec | undefined,
  px: (length: NumberSpec) => number
): { readonly _tag: "Width"; readonly width: WrapWidth } | Unplaceable {
  switch (size.kind) {
    case "fixed":
      return { _tag: "Width", width: { kind: "fixed", width: px(size.length) } };
    case "hug":
      return { _tag: "Width", width: { kind: "hug", width: own } };
    case "fill":
      return minWidth === undefined
        ? unplaceable(
            `${key} fills its line with no minWidth, where every probe broke a line before a filling layer at its minWidth (WR6)`
          )
        : { _tag: "Width", width: { kind: "fill", minWidth: px(minWidth) } };
    case "placed":
      return unplaceable(`${key} takes the width its placement leaves it, which no WRAP line sets`);
  }
}

/** The edges the WRAP layout compares, as a reason names them. */
const EDGES = [
  ["x", "left edge"],
  ["y", "top edge"],
  ["width", "width"],
  ["height", "height"],
] as const;

/**
 * The first layer the WRAP layout places apart from the item CSS laid out, named with its edge and
 * both values, or undefined where every layer sits where CSS set it.
 */
function firstApart(places: readonly WrapPlace[], layout: FlexLineLayout): string | undefined {
  for (const [index, place] of places.entries()) {
    const item = layout.items[index];
    for (const [edge, name] of EDGES) {
      const css = item?.[edge] ?? Number.NaN;
      if (!(Math.abs(place[edge] - css) <= LAYOUT_TOLERANCE_PX)) {
        return `a Figma WRAP row of the layers as the build draws them sets ${place.key}'s ${name} at ${describePx(place[edge])} where CSS sets it at ${describePx(css)}`;
      }
    }
  }
  return undefined;
}

/** A length in pixels as a reason gives it, to the hundredth. */
function describePx(value: number): string {
  return `${String(Math.round(value * 100) / 100)}px`;
}

/** The gap declarations a refused row leaves unmapped, beside its `flex-wrap`. */
const GAP_PROPERTIES = ["gap", "row-gap", "column-gap"] as const;

/**
 * Read a row's `flex-wrap` and gaps as its lines decide: a row on one line drops `flex-wrap`, and
 * the `row-gap` beside it, which spaces lines it never breaks into (CSS Box Alignment 3 §8.1); a
 * WRAP row reads `flex-wrap` as WRAP and each gap from the declaration that wins its axis; and a
 * refused row notes `flex-wrap` and its gaps unmapped with the reason, which no read elsewhere in
 * the cell may override, so the row's item spacing reads none of them.
 *
 * @param style - The row's style.
 * @param lines - How the row draws its lines.
 * @param variables - The synced variables.
 * @returns The WRAP row's gap between lines and between layers, read, or undefined for any other row.
 */
export function readFlexLines(
  style: LayerStyle,
  lines: SettledLines,
  variables: VariableIndex
): { readonly lineGap: NumberSpec; readonly itemSpacing: NumberSpec } | undefined {
  switch (lines._tag) {
    case "Unwrapped":
    case "Undecided":
      return undefined;
    case "MeasuredOneLine":
    case "OneLine": {
      const { detail } = lines;
      const wraps = style.has("flex-wrap");
      style.read(
        "flex-wrap",
        (value) => (normalizeCss(value) === "wrap" ? value : undefined),
        () => ({ outcome: "dropped", detail }),
        []
      );
      if (wraps) {
        style.read(
          "row-gap",
          (value) => value,
          () => ({
            outcome: "dropped",
            detail: `the row sets its layers on one line, as ${detail}, so no gap between lines shows`,
          }),
          []
        );
      }
      return undefined;
    }
    case "Refused":
      for (const property of ["flex-wrap", ...GAP_PROPERTIES]) {
        style.mark(property, "unmapped", lines.reason, []);
      }
      return undefined;
    case "Wraps": {
      style.read(
        "flex-wrap",
        (value) => (normalizeCss(value) === "wrap" ? value : undefined),
        () => ({ outcome: "literal", detail: WRAPS_INTO_LINES }),
        style.feed("lineGap")
      );
      const { row, column } = lines.gaps;
      const read = (property: string, value: string, feed: Feed) =>
        style.read(property, () => readNumber(value, variables), describeNumber, feed);
      if (row !== undefined && row.property === column?.property) {
        read(row.property, row.value, [...style.feed("lineGap"), ...style.feed("itemSpacing")]);
      } else {
        if (row !== undefined) {
          read(row.property, row.value, style.feed("lineGap"));
        }
        if (column !== undefined) {
          read(column.property, column.value, style.feed("itemSpacing"));
        }
      }
      return { lineGap: lines.gaps.lineGap, itemSpacing: lines.gaps.itemSpacing };
    }
  }
}
