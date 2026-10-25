/**
 * A box's label: the box's own text, mapped from the box's style. This module owns the label's
 * typography, how it sizes and truncates in the box, where it sets its lines, where a native
 * control places it, and the gap a space before it draws. `box-mapping.ts` assembles a box's
 * layers, and asks this module for the label, for the line clamp the box's display reads, for that
 * gap, and to settle the text declarations of a box that shows no label.
 */
import { hugsUncapped, listNames, UNREAD_SHARE, widthCapInside } from "./box-sizing";
import type { Holder, WidthCap } from "./box-sizing";
import type { CoverageNote, LayerStyle } from "./cascade";
import type { Cell, LabelDefinition, TextPlacement } from "./component-spec";
import { describeNumber, evaluateLength, evaluateNumber, normalizeCss, readNumber } from "./css-values";
import type { VariableIndex } from "./css-values";
import { HUGGING_TEXT, NO_LIMITS, TOP_LEFT } from "./kit-spec";
import type {
  ColorSpec,
  CounterAlignSpec,
  LetterSpacingSpec,
  LineHeightSpec,
  NumberSpec,
  StringSpec,
  TextAlignSpec,
  TextLayerSpec,
  TextSizingSpec,
} from "./kit-spec";
import type { Layout } from "./placement";

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
  /** The keys of the layers from the root down to the text layer, which the fields its reads fill name. */
  readonly path: readonly string[];
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
  "letter-spacing",
  "text-decoration-line",
  "text-underline-offset",
  "text-align",
  "white-space-collapse",
  "text-wrap-mode",
  "text-wrap-style",
  "overflow-wrap",
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
 * The `text-wrap-style` values that choose where a wrapping text breaks its lines (CSS Text 4 §6.3):
 * `balance` evens out their lengths, and `pretty` keeps a short word off the last one.
 */
const EVENED_LINES = new Set(["balance", "pretty"]);

/**
 * Whether the wrapping longhands let a text wrap: `text-wrap-mode` unset or `wrap`, which `white-space`
 * and `text-wrap` both set, so the cascade's winner decides.
 */
function wraps(mode: string): boolean {
  return mode === "" || mode === "wrap";
}

/**
 * What `white-space-collapse` does to a label's characters: `collapse`, its initial value, folds runs
 * of white space and line breaks into one space, which changes nothing in characters that hold none, so
 * it drops. Characters that hold one, or another value, keep white space a Figma text draws as written,
 * which the build does not compare, so they stay unmapped.
 *
 * @param style - The label's box.
 * @param characters - The characters the label shows.
 */
function readWhiteSpaceCollapse(style: LayerStyle, characters: string): void {
  style.read(
    "white-space-collapse",
    (written) =>
      normalizeCss(written) === "collapse" && !/\s\s|[\t\n\r]|^\s|\s$/.test(characters) ? written : undefined,
    () => ({
      outcome: "dropped",
      detail: "the characters hold no run of white space or line break to collapse",
    }),
    []
  );
}

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
  if (normalizeCss(style.resolved("text-wrap-mode") ?? "") === "nowrap") {
    style.read(
      "text-wrap-mode",
      (value) => value,
      () => ({ outcome: "literal", detail: "the label hugs its width" }),
      // The note passes down to the labels of the box's parts, which fill their own fields.
      []
    );
  }
  for (const property of TEXT_PROPERTIES) {
    style.mark(property, "dropped", "the cell shows no text", []);
  }
  for (const property of ["text-overflow", "-webkit-line-clamp"]) {
    style.mark(property, "dropped", "the box holds no text of its own", []);
  }
}

/** How a block container sets its text: in lines from its start, across its own width. */
const TEXT_BLOCK: Layout = {
  flex: false,
  blocks: false,
  direction: "HORIZONTAL",
  primaryAlign: "MIN",
  counterAlign: "MIN",
  justify: "unset",
};

/** The declarations of a label's element that set how its text sits in its row. */
const ELEMENT_LAYOUT = ["overflow", "text-overflow", "white-space-collapse", "text-wrap-mode"] as const;

/** Why a label's element stays unmapped where a text that fills its row's room would not draw it. */
const UNENDED =
  "the label's element ends no row that packs its layers at the start with none growing and sets its text from the start, where a text that fills the room left draws it";

/** Why a label's element stays unmapped in a row that hugs its width up to a cap. */
const CAPPED_ELEMENT =
  "the row hugs its width up to a cap, where CSS cuts the label's element off, and a text in a hugging frame keeps its own width";

/** The `text-align` values that set a line from its start in a left-to-right page, unset included. */
const FROM_START = new Set(["", "left", "start"]);

/**
 * The box a label sits in where its box holds it in an element of its own that a class styles, as a
 * Sidebar row holds its text in a `<span>` that `[&>span:last-child]:truncate` cuts off. A flex item
 * is blockified (CSS Display 3 §2.7), so the element is a block container that sets the text in lines
 * across its own width and takes its own `text-overflow` (CSS Overflow 3 §4.2), and one that hides
 * its overflow shrinks below its text (CSS Flexbox 1 §4.5). It does not grow (CSS Flexbox 1 §7.1),
 * so last in a row that packs its layers at the start, with none growing, and setting its text from
 * the start, the element is as wide as its text up to the room the row leaves it, which a text that
 * fills that room draws, since nothing sits after it. In a row that hugs its width with no cap on
 * it, the element hugs its text. Anywhere else, a centred or end-aligned text and a row that hugs up
 * to a cap among them, the element's layout stays unmapped, and the label maps from the row.
 *
 * @param row - The box that holds the element, whose last layer the label is.
 * @param element - The element's style.
 * @param label - The label.
 * @param growing - The index of the row's layer that grows, or undefined for none.
 * @returns The element as the box its label sits in, or undefined where its layout stays unmapped.
 */
export function labelElementHolder(
  row: Holder,
  element: LayerStyle,
  label: LabelDefinition,
  growing: number | undefined
): Holder | undefined {
  const { layout } = row;
  const ends =
    layout.flex &&
    layout.direction === "HORIZONTAL" &&
    (layout.justify === "unset" || layout.justify === "MIN") &&
    growing === undefined &&
    FROM_START.has(normalizeCss(element.resolved("text-align") ?? ""));
  const fills = row.sizing.horizontal.kind !== "hug";
  const capped = ends && !fills && widthCapInside(row, row.layers.indexOf(label.name)).kind !== "none";
  if (!ends || capped) {
    for (const property of ELEMENT_LAYOUT) {
      element.mark(property, "unmapped", capped ? CAPPED_ELEMENT : UNENDED, []);
    }
    return undefined;
  }
  element.read(
    "overflow",
    (value) => value,
    (): CoverageNote =>
      fills
        ? { outcome: "literal", detail: "the label's element clips its text at the room the row leaves it" }
        : { outcome: "dropped", detail: NEVER_OVERFLOWS },
    element.feed("sizing")
  );
  return {
    style: element,
    layout: TEXT_BLOCK,
    sizing: { horizontal: fills ? { kind: "fill" } : { kind: "hug" }, vertical: { kind: "hug" } },
    limits: NO_LIMITS,
    extent: { horizontal: undefined, vertical: undefined },
    layers: [label.name],
    widthCap: { kind: "none" },
    // A row that hugs with nothing bounding it lays the element out at its max-content width.
    unbounded: hugsUncapped(row),
    // The rule above decides the element's sizing.
    widthKnown: true,
    shares: [UNREAD_SHARE],
  };
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
    ["", "collapse"].includes(value("white-space-collapse")) &&
    wraps(value("text-wrap-mode"));
  return holds ? lineCount(value("-webkit-line-clamp")) : undefined;
}

/**
 * Why a box's line clamp sets nothing where its display is not `-webkit-box`: `-webkit-line-clamp`
 * and `-webkit-box-orient` take effect only in a `-webkit-box` (CSS Overflow 4 §4.2), so a later
 * `display: flex` over a `line-clamp-*` leaves both inert, as Select's trigger leaves its value.
 *
 * @param style - The box's style.
 * @returns The reason, or undefined for a `-webkit-box`, which the clamp can take effect in.
 */
export function inertClamp(style: LayerStyle): string | undefined {
  const display = normalizeCss(style.resolved("display") ?? "");
  return display === "-webkit-box"
    ? undefined
    : `the box's display is ${display === "" ? "unset" : display}, and a line clamp takes effect only in a -webkit-box`;
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
  const { color, variables, path } = scope;
  const fontSize = style.read(
    "font-size",
    (value) => readNumber(value, variables),
    describeNumber,
    style.feed("fontSize", path)
  );
  const lineHeight = style.read(
    "line-height",
    (value): LineHeightSpec | undefined => {
      const bound = variables.lookup(value);
      if (bound !== undefined) {
        return { kind: "variable", variable: bound };
      }
      const number = evaluateNumber(value);
      if (number === undefined) {
        return undefined;
      }
      if (/px|rem|%/.test(value)) {
        return { kind: "literal", value: number };
      }
      // A unitless line height multiplies the font size: pixels over a literal size, and a percent of
      // a size a variable sets per mode, which a Figma line height in percent follows (PH).
      if (fontSize?.kind === "literal") {
        return { kind: "literal", value: number * fontSize.value };
      }
      return fontSize === undefined ? undefined : { kind: "percent", value: number * 100 };
    },
    describeLineHeight,
    style.feed("lineHeight", path)
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
    }),
    style.feed("fontFamily", path)
  );
  const weight = style.read(
    "font-weight",
    (value) => {
      const number = evaluateNumber(value);
      return number === undefined ? undefined : FONT_STYLES.get(number);
    },
    (fontStyle) => ({ outcome: "literal", detail: `font style ${fontStyle}` }),
    style.feed("fontStyle", path)
  );
  const underline = readUnderline(style, path);
  const letterSpacing = readLetterSpacing(style, path);
  if (fontFamily === undefined || fontSize === undefined || lineHeight === undefined || color === undefined) {
    throw new Error(`${scope.variant}: the label needs a font family, size, line height and color`);
  }
  const lines = label.placement?.lines;
  const characters = labelCharacters(label, scope.cell);
  const layout: LabelLayout =
    lines === undefined
      ? readLabelLayout(holder, label, characters, scope.clamp, scope.variant, path)
      : { ...readNativeLines(holder, lines, scope.variant, path), maxWidth: undefined, packsAtStart: false };
  const fills = layout.sizing.horizontal.kind !== "hug";
  readOverflowWrap(holder, layout);
  const layer: TextLayerSpec = {
    kind: "text",
    key: label.key,
    name: label.name,
    characters,
    textProperty: label.textProperty,
    fontFamily,
    fontStyle: weight ?? "Regular",
    fontSize,
    lineHeight,
    color,
    underline,
    sizing: layout.sizing,
    align: readTextAlign(style, fills ? label.placement : undefined, path),
    truncation: layout.truncation,
  };
  const wraps = layout.maxWidth === undefined ? layer : { ...layer, maxWidth: layout.maxWidth };
  const placed = placeInBox(holder, label.placement);
  return {
    layer: letterSpacing === undefined ? wraps : { ...wraps, letterSpacing },
    primaryAlign: layout.packsAtStart ? "MIN" : placed.primaryAlign,
    counterAlign: placed.counterAlign,
  };
}

/**
 * Read the `overflow-wrap` a label's text takes, set on its box or inherited from a box around it,
 * which breaks a word only where the word would overflow its line (CSS Text 3 §5.5). A text that
 * hugs its width, with no `maxWidth` of its own and nothing bounding the width CSS gives its box, sets
 * each line at its max-content width, where every word fits, so the declaration drops. Any other text
 * can set a line narrower than a word, so it stays unmapped. Every label reads it, so a box with no
 * text of its own that passes it down settles with what its texts make of it.
 *
 * @param holder - The box the label sits in.
 * @param layout - The label's sizing and the width it wraps at.
 */
function readOverflowWrap(holder: Holder, layout: LabelLayout): void {
  const fits =
    layout.sizing.horizontal.kind === "hug" && layout.maxWidth === undefined && hugsUncapped(holder);
  holder.style.read(
    "overflow-wrap",
    (value) => value,
    (): CoverageNote =>
      fits
        ? {
            outcome: "dropped",
            detail:
              "the text hugs its width and nothing bounds the width CSS gives it, so no line is narrower than a word, and no word overflows to break",
          }
        : {
            outcome: "unmapped",
            detail: "the text can set a line narrower than a word, and the builder measures no word",
          },
    []
  );
}

/** What became of a line height, for the coverage table. */
function describeLineHeight(spec: LineHeightSpec): CoverageNote {
  return spec.kind === "percent"
    ? { outcome: "literal", detail: `lines ${spec.value}% of the font size apart` }
    : describeNumber(spec);
}

/** Why an `em` spacing a label inherits from an element of another font size has no Figma form. */
const SPACED_ELSEWHERE =
  "the label inherits this em spacing from an element of another font size, where CSS computes it";

/**
 * Read `letter-spacing` in `em`, a share of the font size, as Figma's percent of it: `-0.025em`, which
 * `tracking-tight` sets, is -2.5%. CSS computes an `em` spacing where it is declared (CSS Text 4
 * §8.2), and a child inherits that length, so the percent holds only where the label's font size is
 * the declaring element's. An inherited spacing at another size, and any other unit, stay unmapped.
 *
 * @param style - The label's box's style.
 * @returns The spacing, or undefined where none maps.
 */
function readLetterSpacing(style: LayerStyle, path: readonly string[]): LetterSpacingSpec | undefined {
  const declared = style.resolvedWhereDeclared("letter-spacing", "font-size");
  const own = style.resolved("font-size");
  const sameSize = declared !== undefined && own !== undefined && sameLength(declared, own);
  const spacing = style.read(
    "letter-spacing",
    (value): LetterSpacingSpec | "elsewhere" | undefined => {
      const ems = /^(-?\d*\.?\d+)em$/.exec(normalizeCss(value))?.[1];
      if (ems === undefined) {
        return undefined;
      }
      return sameSize ? { unit: "PERCENT", value: Number(ems) * 100 } : "elsewhere";
    },
    (read): CoverageNote =>
      read === "elsewhere"
        ? { outcome: "unmapped", detail: SPACED_ELSEWHERE }
        : { outcome: "literal", detail: `letters ${read.value}% of the font size apart` },
    style.feed("letterSpacing", path)
  );
  return spacing === "elsewhere" ? undefined : spacing;
}

/** Whether two computed lengths are the same: the same value, or the same number of pixels. */
function sameLength(left: string, right: string): boolean {
  const pixels = evaluateLength(left);
  return (
    normalizeCss(left) === normalizeCss(right) || (pixels !== undefined && pixels === evaluateLength(right))
  );
}

/**
 * Where a native control's placement puts the label in its box. The label hugs its height, so the
 * box's alignment moves it down, and across where it also hugs its width. A label that fills the
 * width takes the placement across as its own text alignment too, and the box's alignment across
 * still holds it there once a designer makes the text hug.
 */
function placeInBox(
  holder: Holder,
  placement: TextPlacement | undefined
): Pick<MappedLabel, "primaryAlign" | "counterAlign"> {
  if (placement === undefined) {
    return { primaryAlign: undefined, counterAlign: undefined };
  }
  const down = PLACED_ALONG[placement.vertical];
  const across = PLACED_ALONG[placement.horizontal];
  return holder.layout.direction === "HORIZONTAL"
    ? { primaryAlign: across, counterAlign: down }
    : { primaryAlign: down, counterAlign: across };
}

/** Why a native control's one line drops the declarations that set a box's own text in lines. */
const SINGLE_LINE = "the control sets its text on one line itself";

/** How the error for a native control in a box that hugs its width names the way it sets its text. */
const NATIVE_LINES = {
  single: "the control sets its text on one line across its width",
  wrap: "the control wraps its text at its width",
} as const;

/**
 * Read the layout of a label a native control sets in lines itself, across its content box, whatever
 * the box's `display` says, since the text is no line box or anonymous item of the box's own.
 *
 * - `single`, as an `<input>` sets its value: one line cut off at the content box, whatever
 *   `white-space` says. The label fills the width and ends in an ellipsis after one line, the
 *   overflow the owner chose for a value too long for its box, where a browser clips it. The box's
 *   own text declarations shape nothing, so they drop.
 * - `wrap`, as a `<textarea>` wraps its value: lines that break at the content box's width, so the
 *   label fills the width with its height following its lines. A `<textarea>` honours its own
 *   `white-space`, so only `normal` maps, and every other value stays unmapped, as do
 *   `text-overflow` and `-webkit-line-clamp`, which this reader leaves unread.
 *
 * @param variant - The variant's key, for the error.
 * @throws When the box hugs its width. A control with no width of its own takes an intrinsic width
 *   from its `size` or `cols`, which no Figma field holds.
 */
function readNativeLines(
  holder: Holder,
  lines: NonNullable<TextPlacement["lines"]>,
  variant: string,
  path: readonly string[]
): Pick<TextLayerSpec, "sizing" | "truncation"> {
  if (holder.sizing.horizontal.kind === "hug") {
    throw new Error(`${variant}: ${NATIVE_LINES[lines]}, so its box needs a fixed or filling width`);
  }
  if (lines === "wrap") {
    holder.style.read(
      "text-wrap-mode",
      (written) => (wraps(normalizeCss(written)) ? written : undefined),
      () => ({ outcome: "literal", detail: "the label wraps at the box's width" }),
      holder.style.feed("sizing", path)
    );
    holder.style.read(
      "white-space-collapse",
      (written) => (normalizeCss(written) === "collapse" ? written : undefined),
      () => ({ outcome: "dropped", detail: "the label draws the value's characters as written" }),
      []
    );
    return { sizing: FILLING, truncation: undefined };
  }
  for (const property of [
    "white-space-collapse",
    "text-wrap-mode",
    "text-wrap-style",
    "text-overflow",
    "-webkit-line-clamp",
  ]) {
    holder.style.read(
      property,
      (written) => written,
      () => ({ outcome: "dropped", detail: SINGLE_LINE }),
      []
    );
  }
  return { sizing: FILLING, truncation: { maxLines: 1 } };
}

function readUnderline(style: LayerStyle, path: readonly string[]): TextLayerSpec["underline"] {
  const underlined = style.read(
    "text-decoration-line",
    (value) => {
      const line = normalizeCss(value);
      return line === "underline" ? true : line === "none" ? false : undefined;
    },
    (drawn) => ({ outcome: "literal", detail: drawn ? "an underline" : "no decoration" }),
    style.feed("underline", path)
  );
  if (underlined !== true) {
    style.mark("text-underline-offset", "dropped", "the cell draws no underline", []);
    return undefined;
  }
  return {
    offset: style.read(
      "text-underline-offset",
      evaluateNumber,
      (offset) => ({ outcome: "literal", detail: `an underline offset of ${offset}px` }),
      style.feed("underline", path)
    ),
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
function readTextAlign(
  style: LayerStyle,
  placement: TextPlacement | undefined,
  path: readonly string[]
): TextAlignSpec {
  const across = style.read(
    "text-align",
    (value) => TEXT_ALIGNS.get(normalizeCss(value)),
    ({ where }) => ({ outcome: "literal", detail: `the label sets its lines ${where}` }),
    style.feed("align", path)
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
 * A box that hugs its width grows to its `max-width` and no further, so CSS truncates or clamps the
 * label there, or wraps it at a `max-width` that is no literal length. A text in a hugging Figma
 * frame keeps its own width past the frame's limit, as a real file showed on 2026-10-22 (P7). A
 * wrapping label at a literal cap takes it as its own `maxWidth` instead, which wraps it there.
 */
const CAPPED: Refusal = {
  anchor: "max-width",
  detail:
    "the box hugs its width up to its max-width, where CSS wraps or cuts off the label, and a text in a hugging frame keeps its own width",
};

/**
 * Whether a flex row's text item draws as a text that fills the room the row's other layer leaves:
 * the label is the first of two layers that the row spaces between its ends, it sets its lines from
 * the start, and the other layer is as wide as a length says. The item then sits at the start,
 * shrinks to the room the other layer and the row's gap leave and wraps there (CSS Flexbox 1 §9.7),
 * and the other layer ends the row, as a vertical Navigation menu trigger holds its title and caret.
 * The gap is the least space between them under any distributed alignment (CSS Box Alignment 3 §8),
 * and a filling text leaves no room to space out, so the row packs its layers at the start with its
 * gap between them, which draws what CSS draws. On 2026-10-23 a real file kept no gap under
 * SPACE_BETWEEN beside a filling text: the text took the whole room and met the caret (PV). The
 * builder measures no text, so a label whose longest word is wider than that room draws wrapped in
 * Figma, where CSS keeps the word whole and pushes the other layer out (CSS Flexbox 1 §4.5).
 */
function spacedFirst(holder: Holder, label: LabelDefinition, across: Across): boolean {
  const { layout, layers, shares } = holder;
  return (
    layout.direction === "HORIZONTAL" &&
    layout.justify === "SPACE_BETWEEN" &&
    layers.length === 2 &&
    layers[0] === label.name &&
    shares[1]?.kind === "pixels" &&
    across === "LEFT"
  );
}

/**
 * Whether a flex row's text item draws as a text that fills the room before the row's last layer,
 * whose auto start margin takes the free space (CSS Flexbox 1 §8.1), as `readAutoStart` in
 * `box-flow.ts` reads it for three or more layers: the label sits right before that layer and sets its
 * lines from the start. The label then paints nothing past its text, so a fill draws what CSS draws
 * at any length of text that fits.
 */
function fillsBeforeMargin(holder: Holder, label: LabelDefinition, across: Across): boolean {
  const { layout, layers } = holder;
  return (
    layout.direction === "HORIZONTAL" &&
    layout.labelFills === true &&
    layers.length > 2 &&
    layers.at(-2) === label.name &&
    across === "LEFT"
  );
}

/** What a row's `justify-content` draws where its label fills the room as {@link spacedFirst} says. */
const SPACED_FIRST =
  "the label fills the room the other layer leaves, so nothing is left to space out, and the row packs its layers at the start with its gap between them";

/**
 * Find where a flex or grid box sets its wrapping text somewhere a filling text does not. The text
 * is an anonymous item, which does not grow (CSS Flexbox 1 §7.1), so a short label sits at its own
 * width where the box places it, while a text that fills the box sets its lines by its alignment.
 * The two agree across a column that stretches the item, and where the box places the item where
 * the text sets its lines. Beside other layers in a row the label keeps its own width, where a fill
 * takes the room they leave, unless {@link spacedFirst} says the two agree. A grid sets its text as a
 * grid item, which a fill does not draw.
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
 * {@link refuseItem} decides for. A flex item whose text {@link neverWraps} keeps its own width
 * wherever the box places it, so where the item's place refuses a fill, the label hugs there.
 * A `text-wrap-mode` of `nowrap`, which `white-space: nowrap` and `text-wrap: nowrap` set and the
 * cascade takes from the declaration nearer the label, keeps the text on one line at its own width,
 * so the label hugs, unless a block box also hides its overflow behind an ellipsis, as `truncate`
 * does: then the label fills and ends in an ellipsis after one line. A line clamp ends wrapping
 * text after its lines. A box that hugs its width is as wide as its text on one line, since a kit
 * frame always has room to spare, so the label hugs and the ellipsis drops, unless a `max-width`
 * stops the box first. A wrapping label
 * in such a box hugs up to the cap the box and the boxes around it set, as {@link widthCapInside}
 * reads it, and a hugging Figma text with that `maxWidth` wraps there (P7).
 *
 * @param characters - The text the label shows in the cell.
 * @param variant - The variant's key, for the error.
 * @throws When a box around a wrapping label caps its width at a length that is no literal, which
 *   the label's `maxWidth` needs.
 */
function readLabelLayout(
  holder: Holder,
  label: LabelDefinition,
  characters: string,
  lines: number | undefined,
  variant: string,
  path: readonly string[]
): LabelLayout {
  const { style, sizing } = holder;
  const value = (property: string): string => normalizeCss(style.resolved(property) ?? "");
  const mode = value("text-wrap-mode");
  const wrapping = wraps(mode);
  const truncates =
    value("overflow") === "hidden" && mode === "nowrap" && value("text-overflow") === "ellipsis";
  // `text-overflow` applies to block containers (CSS Overflow 3 §4.2). A flex or grid box sets its
  // own text as an anonymous item, which it clips with no ellipsis.
  const item = textItem(holder);
  const ellipsis = truncates && item === undefined;
  const maxLines = ellipsis ? 1 : lines;
  const definite = sizing.horizontal.kind !== "hug";
  const cap: WidthCap =
    !definite && wrapping && !ellipsis && lines === undefined
      ? widthCapInside(holder, holder.layers.indexOf(label.name))
      : { kind: "none" };
  if (cap.kind === "unread" && holder.limits.maxWidth === undefined) {
    throw new Error(
      `${variant}: a box around ${label.name} caps its width, and the build cannot read in pixels the room the label has under it`
    );
  }
  if (cap.kind === "pixels" && cap.value <= 0) {
    throw new Error(
      `${variant}: a box around ${label.name} caps its width at ${cap.value}px, and Figma takes only a positive max width`
    );
  }
  const capped =
    !definite &&
    holder.limits.maxWidth !== undefined &&
    (ellipsis || lines !== undefined || cap.kind === "unread");
  const maxWidth = cap.kind === "pixels" ? cap.value : undefined;
  const across = linesAcross(style, label.placement);
  const placed =
    definite && wrapping && item !== undefined ? refuseItem(holder, item, label, across) : undefined;
  // The item never shrinks below its one line, so it sits at its own width, which a hugging text draws.
  const ownWidth = placed !== undefined && item === "flex" && neverWraps(style, characters);
  const beforeMargin = definite && !capped && item === "flex" && fillsBeforeMargin(holder, label, across);
  const spaced =
    beforeMargin ||
    (!capped && placed !== undefined && !ownWidth && item === "flex" && spacedFirst(holder, label, across));
  const refusal = capped ? CAPPED : ownWidth || spaced ? undefined : placed;
  if (spaced) {
    style.read(
      "justify-content",
      (written) => written,
      () => ({ outcome: "literal", detail: SPACED_FIRST }),
      // The row packs its layers at its start, which its own alignment draws.
      style.feed("primaryAlign", path.slice(0, -1))
    );
  }
  const fills =
    definite &&
    refusal === undefined &&
    (beforeMargin || (!ownWidth && (wrapping || maxLines !== undefined)));
  const truncation = fills && maxLines !== undefined ? { maxLines } : undefined;
  if (refusal !== undefined) {
    style.read(
      refusal.anchor,
      (written) => written,
      () => ({ outcome: "unmapped", detail: refusal.detail }),
      []
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

  readWhiteSpaceCollapse(style, characters);
  style.read(
    "text-wrap-mode",
    (written) => (["wrap", "nowrap"].includes(normalizeCss(written)) ? written : undefined),
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
      if (ownWidth) {
        return { outcome: "literal", detail: "the text never wraps, so the label keeps its own width" };
      }
      if (maxWidth !== undefined) {
        return { outcome: "literal", detail: "the label wraps at the max width the boxes around it set" };
      }
      return {
        outcome: "literal",
        detail: fills ? "the label wraps at the box's width" : "the box hugs the label on one line",
      };
    },
    style.feed("sizing", path)
  );
  // `text-wrap-style` chooses where a text that wraps breaks its lines, so on a text the cascade's
  // `text-wrap-mode` keeps on one line it has no lines to choose.
  style.read(
    "text-wrap-style",
    (written) => (EVENED_LINES.has(normalizeCss(written)) ? written : undefined),
    (): CoverageNote => {
      if (refusal !== undefined) {
        return { outcome: "unmapped", detail: refusal.detail };
      }
      if (!wrapping) {
        return { outcome: "dropped", detail: "the label keeps to one line, so it breaks no lines to choose" };
      }
      if (fills || maxWidth !== undefined) {
        return {
          outcome: "dropped",
          detail: "a Figma text fills each line before it starts the next, so it cannot even out its lines",
        };
      }
      return {
        outcome: "dropped",
        detail: ownWidth
          ? "the text never wraps, so the label keeps its own width"
          : "the box hugs the label on one line",
      };
    },
    []
  );
  style.read(
    "text-overflow",
    (written) => (truncates ? written : undefined),
    () => cut(ending(1)),
    style.feed("truncation", path)
  );
  const inert = inertClamp(style);
  if (inert === undefined) {
    style.read(
      "-webkit-line-clamp",
      (written) => (lines !== undefined ? written : undefined),
      () => cut(ending(lines ?? 0)),
      style.feed("truncation", path)
    );
  } else {
    style.mark("-webkit-line-clamp", "dropped", inert, []);
  }
  return {
    sizing: fills ? FILLING : HUGGING_TEXT,
    truncation,
    maxWidth: maxWidth === undefined ? undefined : { kind: "literal", value: maxWidth },
    packsAtStart: spaced,
  };
}

/** How a label sizes, truncates and wraps at a max width, as {@link readLabelLayout} reads it. */
type LabelLayout = Pick<TextLayerSpec, "sizing" | "truncation"> & {
  /** The width a hugging label wraps at, or undefined for none. */
  readonly maxWidth: NumberSpec | undefined;
  /**
   * Whether the label fills the room its row's other layer and gap leave, as {@link spacedFirst}
   * decides, so the row packs its layers at the start with its gap between them.
   */
  readonly packsAtStart: boolean;
};

/**
 * The advance width of Roboto's space, U+0020, in font units by Figma style, of 2048 units per em, as
 * the `hmtx` tables of `@fontsource/roboto` 5.3.0, which serves Google's Roboto, hold it. Roboto is
 * the family `font-sans` holds in every theme, so it is the one family a kit label sets.
 */
const ROBOTO_SPACE = new Map([
  ["Regular", 508],
  ["Medium", 509],
]);

/** Roboto's units per em. */
const ROBOTO_UNITS_PER_EM = 2048;

/**
 * The gap the space the markup holds before a label draws after the box's one start icon. A box that
 * sets its text in lines puts the space between the icon and the characters, one space advance of
 * the label's font wide, which the box's auto layout gap draws. With no icon before it the space
 * starts the line, and in a flex or grid box it starts the text's anonymous item, and either way it
 * collapses, so it draws no gap.
 *
 * @param holder - The label's box.
 * @param label - The label.
 * @param layer - The label's text layer.
 * @param startIcons - How many icons the box shows before the label.
 * @param variant - The variant's key, for the error.
 * @returns The gap, or undefined where the space draws none.
 * @throws When the space would sit beside more than one icon and the label, which one gap cannot draw,
 *   or the label's size is no literal or its style has no measured space.
 */
export function spaceBeforeLabel(
  holder: Holder,
  label: LabelDefinition,
  layer: TextLayerSpec,
  startIcons: number,
  variant: string
): NumberSpec | undefined {
  if (label.leadingSpace !== true || startIcons === 0 || textItem(holder) !== undefined) {
    return undefined;
  }
  const advance = ROBOTO_SPACE.get(layer.fontStyle);
  if (holder.layers.length !== 2 || layer.fontSize.kind !== "literal" || advance === undefined) {
    throw new Error(
      `${variant}: the space before ${label.name} draws as its box's gap only between one start icon and the label, at a literal size in Roboto ${[...ROBOTO_SPACE.keys()].join(" or ")}`
    );
  }
  return { kind: "literal", value: (advance / ROBOTO_UNITS_PER_EM) * layer.fontSize.value };
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

/**
 * ASCII letters and digits alone, which line breaking keeps together (UAX #14 classes AL and NU), so
 * such a text holds no soft wrap opportunity, as Avatar's initials hold none. Script is no guide:
 * fullwidth letters such as `ＡＬ` are Latin and take class ID, which breaks between them. A space,
 * a hyphen and every other character count as breakable, the safe answer.
 */
const UNBREAKABLE = /^[A-Za-z0-9]+$/;

/**
 * The properties that can break a text inside a word (CSS Text 3 §5.2 to §5.5). The build reads none
 * of them, so a class that sets one lands unmapped wherever it sits.
 */
const WORD_BREAKING = ["word-break", "line-break", "hyphens", "overflow-wrap"] as const;

/**
 * Whether a browser never wraps a text: it holds no soft wrap opportunity, and the box sets nothing
 * that breaks inside a word. Such a text sets one line at its own width whatever room the box gives
 * it.
 */
function neverWraps(style: LayerStyle, characters: string): boolean {
  return UNBREAKABLE.test(characters) && WORD_BREAKING.every((property) => !style.has(property));
}

/** The lines `-webkit-line-clamp` keeps: a whole number of at least 1, or undefined for any other value. */
function lineCount(value: string): number | undefined {
  const count = evaluateNumber(value);
  return count !== undefined && Number.isInteger(count) && count >= 1 ? count : undefined;
}
