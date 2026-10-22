/**
 * A box's label: the box's own text, mapped from the box's style. This module owns the label's
 * typography, how it sizes and truncates in the box, where it sets its lines, and where a native
 * control places it. `component-spec.ts` assembles a box's layers, and asks this module for the
 * label, for the line clamp the box's display reads, and to settle the text declarations of a box
 * that shows no label.
 */
import { listNames } from "./box-sizing";
import type { Holder } from "./box-sizing";
import type { CoverageNote, LayerStyle } from "./cascade";
import type { Cell, LabelDefinition, TextPlacement } from "./component-spec";
import { describeNumber, evaluateNumber, normalizeCss, readNumber } from "./css-values";
import type { VariableIndex } from "./css-values";
import { HUGGING_TEXT, TOP_LEFT } from "./kit-spec";
import type {
  ColorSpec,
  CounterAlignSpec,
  StringSpec,
  TextAlignSpec,
  TextLayerSpec,
  TextSizingSpec,
} from "./kit-spec";

/** A box's label, and the alignments a native control's placement gives the box, where it sets them. */
export type MappedLabel = {
  readonly layer: TextLayerSpec;
  readonly primaryAlign: CounterAlignSpec | undefined;
  readonly counterAlign: CounterAlignSpec | undefined;
};

/** What mapping a label reads besides the box's style. */
export type LabelScope = {
  readonly cell: Cell;
  readonly variables: VariableIndex;
  /** The box's text color, which the label takes. */
  readonly color: ColorSpec | undefined;
  /** The lines the box clamps its label to, as {@link readLineClamp} decides, or undefined for none. */
  readonly clamp: number | undefined;
  /** The variant's key, for errors. */
  readonly variant: string;
};

/** The Figma style of each Roboto weight a recipe reaches. */
const FONT_STYLES = new Map([
  [400, "Regular"],
  [500, "Medium"],
  [600, "SemiBold"],
  [700, "Bold"],
]);

/** The text properties a label reads, which a box without a label drops. */
const TEXT_PROPERTIES = [
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "text-decoration-line",
  "text-underline-offset",
  "text-align",
] as const;

/** Where `text-align` sets a label's lines, by the value Tailwind compiles, in a left-to-right page. */
const TEXT_ALIGNS = new Map<string, { readonly align: TextAlignSpec["horizontal"]; readonly where: string }>([
  ["left", { align: "LEFT", where: "at the left" }],
  ["start", { align: "LEFT", where: "at the left" }],
  ["center", { align: "CENTER", where: "in the center" }],
  ["right", { align: "RIGHT", where: "at the right" }],
  ["end", { align: "RIGHT", where: "at the right" }],
]);

/** The text alignment across each horizontal placement a definition names takes. */
const PLACED_ACROSS = { start: "LEFT", center: "CENTER", end: "RIGHT" } as const;

/** The box alignment that puts a hugging label where a definition places it, on either axis. */
const PLACED_ALONG = { start: "MIN", top: "MIN", center: "CENTER", end: "MAX", bottom: "MAX" } as const;

/** A label that fills its box's width, its height following its lines. */
const FILLING: TextSizingSpec = { horizontal: { kind: "fill" }, vertical: { kind: "hug" } };

/** Why a hugging box drops the declarations that cut its label off. */
const NEVER_OVERFLOWS = "the box hugs the label, so it never overflows";

/**
 * The characters a label shows in a cell.
 *
 * @param label - The label.
 * @param cell - The cell.
 * @returns The label's one text, or the text it gives the cell.
 */
export function labelCharacters(label: LabelDefinition, cell: Cell): string {
  return label.charactersFor === undefined ? label.characters : label.charactersFor(cell);
}

/**
 * Settle the text declarations of a box that shows no label in the cell. `nowrap` passes down to
 * the labels of the box's parts, which read the same note. Every other text property drops, and so
 * do `text-overflow` and `-webkit-line-clamp`, which do not inherit and so cut off no text but the
 * box's own.
 *
 * @param style - The box's style.
 */
export function readWithoutLabel(style: LayerStyle): void {
  style.read(
    "white-space",
    (value) => (normalizeCss(value) === "nowrap" ? value : undefined),
    () => ({ outcome: "literal", detail: "the label hugs its width" })
  );
  for (const property of TEXT_PROPERTIES) {
    style.mark(property, "dropped", "the cell shows no text");
  }
  for (const property of ["text-overflow", "-webkit-line-clamp"]) {
    style.mark(property, "dropped", "the box holds no text of its own");
  }
}

/**
 * Decide whether a box clamps its label, as `line-clamp-*` makes it: a vertical `-webkit-box` that
 * hides its overflow and holds only its label, whose text wraps, at a `-webkit-line-clamp` of a
 * whole number of lines.
 *
 * @param holder - The box.
 * @param label - The label the box shows in the cell, or undefined for none.
 * @returns The lines the box clamps its label to, or undefined where it draws no clamp, which leaves
 *   the box's `-webkit-box` and every clamp declaration unmapped. The box's display and its label
 *   both read this one decision.
 */
export function readLineClamp(holder: Holder, label: LabelDefinition | undefined): number | undefined {
  const value = (property: string): string => normalizeCss(holder.style.resolved(property) ?? "");
  const holds =
    value("display") === "-webkit-box" &&
    label !== undefined &&
    holder.layers.length === 1 &&
    value("-webkit-box-orient") === "vertical" &&
    value("overflow") === "hidden" &&
    wraps(value("white-space"));
  return holds ? lineCount(value("-webkit-line-clamp")) : undefined;
}

/**
 * Map the label a box shows from the box's style.
 *
 * @param holder - The box.
 * @param label - The label.
 * @param scope - The cell, the variables, the box's text color and line clamp.
 * @returns The text layer, and the alignments a native control's placement gives the box.
 * @throws When the box's style gives the label no font family, size, line height or color.
 */
export function mapLabel(holder: Holder, label: LabelDefinition, scope: LabelScope): MappedLabel {
  const { style } = holder;
  const { color, variables } = scope;
  const fontSize = style.read("font-size", (value) => readNumber(value, variables), describeNumber);
  const lineHeight = style.read(
    "line-height",
    (value) => {
      const bound = variables.lookup(value);
      if (bound !== undefined) {
        return { kind: "variable" as const, variable: bound };
      }
      const number = evaluateNumber(value);
      if (number === undefined) {
        return undefined;
      }
      // A unitless line height multiplies the font size, which must then be a literal.
      if (/px|rem|%/.test(value)) {
        return { kind: "literal" as const, value: number };
      }
      return fontSize?.kind === "literal"
        ? { kind: "literal" as const, value: number * fontSize.value }
        : undefined;
    },
    describeNumber
  );
  const fontFamily = style.read(
    "font-family",
    (value): StringSpec | undefined => {
      const bound = variables.lookup(value);
      return bound === undefined ? undefined : { kind: "variable", variable: bound };
    },
    (spec) => ({
      outcome: "bound",
      detail: spec.kind === "variable" ? `${spec.variable.collection} / ${spec.variable.name}` : spec.value,
    })
  );
  const weight = style.read(
    "font-weight",
    (value) => {
      const number = evaluateNumber(value);
      return number === undefined ? undefined : FONT_STYLES.get(number);
    },
    (fontStyle) => ({ outcome: "literal", detail: `font style ${fontStyle}` })
  );
  const underline = readUnderline(style);
  if (fontFamily === undefined || fontSize === undefined || lineHeight === undefined || color === undefined) {
    throw new Error(`${scope.variant}: the label needs a font family, size, line height and color`);
  }
  const layout = readLabelLayout(holder, label, scope.clamp);
  const fills = layout.sizing.horizontal.kind !== "hug";
  return {
    layer: {
      kind: "text",
      key: label.key,
      name: label.name,
      characters: labelCharacters(label, scope.cell),
      textProperty: label.textProperty,
      fontFamily,
      fontStyle: weight ?? "Regular",
      fontSize,
      lineHeight,
      color,
      underline,
      sizing: layout.sizing,
      align: readTextAlign(style, fills ? label.placement : undefined),
      truncation: layout.truncation,
    },
    ...placeInBox(holder, label.placement, fills),
  };
}

/**
 * Where a native control's placement puts the label in its box. The label hugs its height, so the
 * box's alignment moves it down, and across where it also hugs its width. A label that fills the
 * width takes the placement across as its own text alignment instead.
 */
function placeInBox(
  holder: Holder,
  placement: TextPlacement | undefined,
  fills: boolean
): Pick<MappedLabel, "primaryAlign" | "counterAlign"> {
  if (placement === undefined) {
    return { primaryAlign: undefined, counterAlign: undefined };
  }
  const down = PLACED_ALONG[placement.vertical];
  const across = fills ? undefined : PLACED_ALONG[placement.horizontal];
  return holder.layout.direction === "HORIZONTAL"
    ? { primaryAlign: across, counterAlign: down }
    : { primaryAlign: down, counterAlign: across };
}

function readUnderline(style: LayerStyle): TextLayerSpec["underline"] {
  const underlined = style.read(
    "text-decoration-line",
    (value) => {
      const line = normalizeCss(value);
      return line === "underline" ? true : line === "none" ? false : undefined;
    },
    (drawn) => ({ outcome: "literal", detail: drawn ? "an underline" : "no decoration" })
  );
  if (underlined !== true) {
    style.mark("text-underline-offset", "dropped", "the cell draws no underline");
    return undefined;
  }
  return {
    offset: style.read("text-underline-offset", evaluateNumber, (offset) => ({
      outcome: "literal",
      detail: `an underline offset of ${offset}px`,
    })),
  };
}

/**
 * Read where a label sets its lines in its box. A `text-align` the box sets or inherits sets them
 * across. Otherwise the definition's placement does, for a label that fills its box's width. The
 * label hugs its height, so its lines start at the top of its own box. CSS sets a box's text from
 * the top left, which a label without either keeps.
 *
 * @param placement - The placement across that a filling label takes, or undefined for none.
 */
function readTextAlign(style: LayerStyle, placement: TextPlacement | undefined): TextAlignSpec {
  const across = style.read(
    "text-align",
    (value) => TEXT_ALIGNS.get(normalizeCss(value)),
    ({ where }) => ({ outcome: "literal", detail: `the label sets its lines ${where}` })
  )?.align;
  const placed = placement === undefined ? TOP_LEFT.horizontal : PLACED_ACROSS[placement.horizontal];
  return { horizontal: across ?? placed, vertical: TOP_LEFT.vertical };
}

/** Where a label that fills its box would set its lines, as {@link readTextAlign} reads it, without a read. */
function linesAcross(style: LayerStyle, placement: TextPlacement | undefined): Across {
  const css = TEXT_ALIGNS.get(normalizeCss(style.resolved("text-align") ?? ""))?.align;
  return css ?? (placement === undefined ? "LEFT" : PLACED_ACROSS[placement.horizontal]);
}

/** A place across a box, named as text alignment names it. */
type Across = TextAlignSpec["horizontal"];

/** Where a flex box's alignment puts a layer across, named as text alignment names the place. */
const PLACE_OF = { MIN: "LEFT", CENTER: "CENTER", MAX: "RIGHT" } as const;

/** How a box's placement of a layer reads in a coverage detail. */
const PLACED_WHERE = { LEFT: "at the start", CENTER: "in the center", RIGHT: "at the end" } as const;

/** How a text's alignment of its lines reads in a coverage detail. */
const LINES_WHERE = { LEFT: "at the left", CENTER: "in the center", RIGHT: "at the right" } as const;

/** Why a label's sizing has no Figma form, and the declaration whose class the row goes under. */
type Refusal = {
  readonly anchor: string;
  readonly detail: string;
};

/**
 * A box that hugs its width grows to its `max-width` and no further, so CSS wraps, truncates or
 * clamps the label there. A text in a hugging Figma frame keeps its own width past the frame's
 * limit, as a real file showed on 2026-10-22 (P7). A text `maxWidth` would wrap it, which the first
 * set that needs it can map.
 */
const CAPPED: Refusal = {
  anchor: "max-width",
  detail:
    "the box hugs its width up to its max-width, where CSS wraps or cuts off the label, and a text in a hugging frame keeps its own width",
};

/**
 * Find where a flex or grid box sets its wrapping text somewhere a filling text does not. The text
 * is an anonymous item, which does not grow (CSS Flexbox 1 §7.1), so a short label sits at its own
 * width where the box places it, while a text that fills the box sets its lines by its alignment.
 * The two agree across a column that stretches the item, and where the box places the item where
 * the text sets its lines. Beside other layers in a row the label keeps its own width, where a fill
 * takes the room they leave. A grid sets its text as a grid item, which a fill does not draw.
 *
 * @returns Why the label cannot fill, or undefined where a fill draws what CSS draws.
 */
function refuseItem(
  holder: Holder,
  item: "flex" | "grid",
  label: LabelDefinition,
  across: Across
): Refusal | undefined {
  const { layout, style, layers } = holder;
  if (item === "grid") {
    return {
      anchor: "display",
      detail:
        "a grid sets the label as a grid item at its own width, where a text that fills sets its lines across the box",
    };
  }
  const column = layout.direction === "VERTICAL";
  if (column && !style.has("align-items")) {
    return undefined;
  }
  const others = layers.filter((name) => name !== label.name);
  if (!column && others.length > 0) {
    return {
      anchor: "display",
      detail: `the label shares the row with ${listNames(others)}, so it keeps its own width, where a text that fills takes the room left`,
    };
  }
  const justify = layout.justify === "unset" || layout.justify === "SPACE_BETWEEN" ? "MIN" : layout.justify;
  const place = PLACE_OF[column ? layout.counterAlign : justify];
  if (place === across) {
    return undefined;
  }
  // The row goes under the declaration that places the label, or under the box's own display where
  // a definition's placement sets the lines.
  const anchor = column
    ? "align-items"
    : (["justify-content", "text-align"].find((property) => style.has(property)) ?? "display");
  return {
    anchor,
    detail: `the ${column ? "column" : "row"} places the label at its own width ${PLACED_WHERE[place]}, where a text that fills it sets its lines ${LINES_WHERE[across]}`,
  };
}

/**
 * Read how a box's label sizes and truncates. The label is the box's own text. A block box sets it
 * in lines across its content width (CSS Text 3), so where that width is definite, fixed or
 * filling, text that wraps breaks its lines there, and the label fills the width with its height
 * following its lines. A flex or grid box sets the text as an anonymous item, which
 * {@link refuseItem} decides for. `white-space: nowrap` keeps the text on one line at its own width,
 * so the label hugs, unless a block box also hides its overflow behind an ellipsis, as `truncate`
 * does: then the label fills and ends in an ellipsis after one line. A line clamp ends wrapping text
 * after its lines. A box that hugs its width is as wide as its text on one line, since a kit frame
 * always has room to spare, so the label hugs and the ellipsis drops, unless a `max-width` stops the
 * box first.
 */
function readLabelLayout(
  holder: Holder,
  label: LabelDefinition,
  lines: number | undefined
): Pick<TextLayerSpec, "sizing" | "truncation"> {
  const { style, sizing } = holder;
  const value = (property: string): string => normalizeCss(style.resolved(property) ?? "");
  const whiteSpace = value("white-space");
  const wrapping = wraps(whiteSpace);
  const truncates =
    value("overflow") === "hidden" && whiteSpace === "nowrap" && value("text-overflow") === "ellipsis";
  // `text-overflow` applies to block containers (CSS Overflow 3 §4.2). A flex or grid box sets its
  // own text as an anonymous item, which it clips with no ellipsis.
  const item = textItem(holder);
  const ellipsis = truncates && item === undefined;
  const maxLines = ellipsis ? 1 : lines;
  const definite = sizing.horizontal.kind !== "hug";
  const capped = !definite && holder.limits.maxWidth !== undefined && (wrapping || ellipsis);
  const refusal = capped
    ? CAPPED
    : definite && wrapping && item !== undefined
      ? refuseItem(holder, item, label, linesAcross(style, label.placement))
      : undefined;
  const fills = definite && refusal === undefined && (wrapping || maxLines !== undefined);
  const truncation = fills && maxLines !== undefined ? { maxLines } : undefined;
  if (refusal !== undefined) {
    style.read(
      refusal.anchor,
      (written) => written,
      () => ({ outcome: "unmapped", detail: refusal.detail })
    );
  }
  const cut = (detail: string): CoverageNote => {
    if (truncates && item !== undefined) {
      return {
        outcome: "dropped",
        detail: `a ${item} box sets its text as a ${item} item, which takes no ellipsis`,
      };
    }
    if (refusal !== undefined) {
      return { outcome: "unmapped", detail: refusal.detail };
    }
    return fills ? { outcome: "literal", detail } : { outcome: "dropped", detail: NEVER_OVERFLOWS };
  };
  const ending = (count: number): string =>
    `the label ends in an ellipsis after ${count} ${count === 1 ? "line" : "lines"}`;

  style.read(
    "white-space",
    (written) => (["normal", "nowrap"].includes(normalizeCss(written)) ? written : undefined),
    (): CoverageNote => {
      if (refusal !== undefined) {
        return { outcome: "unmapped", detail: refusal.detail };
      }
      if (!wrapping) {
        return {
          outcome: "literal",
          detail: fills ? "the label keeps to one line" : "the label hugs its width",
        };
      }
      return {
        outcome: "literal",
        detail: fills ? "the label wraps at the box's width" : "the box hugs the label on one line",
      };
    }
  );
  style.read(
    "text-overflow",
    (written) => (truncates ? written : undefined),
    () => cut(ending(1))
  );
  style.read(
    "-webkit-line-clamp",
    (written) => (lines !== undefined ? written : undefined),
    () => cut(ending(lines ?? 0))
  );
  return { sizing: fills ? FILLING : HUGGING_TEXT, truncation };
}

/**
 * The kind of item a box makes of its own text: `flex` or `grid` where the box lays its text out as
 * an anonymous item, or undefined for a block container, which sets the text in line boxes across
 * its content width.
 */
function textItem(holder: Holder): "flex" | "grid" | undefined {
  if (holder.layout.flex) {
    return "flex";
  }
  const display = normalizeCss(holder.style.raw("display") ?? "");
  return display === "grid" || display === "inline-grid" ? "grid" : undefined;
}

/** Whether a `white-space` value lets text wrap: unset, or `normal`. */
function wraps(whiteSpace: string): boolean {
  return whiteSpace === "" || whiteSpace === "normal";
}

/** The lines `-webkit-line-clamp` keeps: a whole number of at least 1, or undefined for any other value. */
function lineCount(value: string): number | undefined {
  const count = evaluateNumber(value);
  return count !== undefined && Number.isInteger(count) && count >= 1 ? count : undefined;
}
