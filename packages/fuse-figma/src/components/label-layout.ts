/**
 * A box's label: the box's own text, mapped from the box's style. This module owns the label's
 * typography, how it sizes and truncates in the box, where it sets its lines, where a native
 * control places it, and the gap a space before it draws. `box-mapping.ts` assembles a box's
 * layers, and asks this module for the label, for that gap, and to settle the text declarations of
 * a box that shows no label, and `label-wrap.ts` for the line clamp the box's display reads.
 *
 * The label's sizing and truncation, the rows where it fills and the lines a native control sets
 * live in `label-sizing.ts`, its wrap rules and line clamp in `label-wrap.ts`, its text alignment
 * in `label-alignment.ts` and its decoration in `label-decoration.ts`.
 */

import type { CapturedText, TextRun } from "./box-cascade";
import { hugsUncapped, UNREAD_SHARE, widthCapInside } from "./box-sizing";
import type { Holder } from "./box-sizing";
import { KitUnmappable } from "./build-errors";
import type { BuildContext, Cell, LabelDefinition } from "./component-spec";
import { labelCharacters } from "./component-spec";
import { evaluateLength, normalizeCss } from "./css-values";
import type { VariableIndex } from "./css-values";
import type { DrawnWidth } from "./flex-item-width";
import { readFaceStyle } from "./italic-face";
import { NO_LIMITS } from "./kit-spec";
import type { ColorSpec, CounterAlignSpec, NumberSpec, TextLayerSpec } from "./kit-spec";
import { readTextAlign } from "./label-alignment";
import type { PlacedLabel, TextPlacement } from "./label-alignment";
import { readDecoration } from "./label-decoration";
import {
  endsInEllipsis,
  isLabel,
  NEVER_OVERFLOWS,
  readLabelLayout,
  readNativeLines,
  readOverflowWrap,
  textItem,
} from "./label-sizing";
import type { LabelLayout } from "./label-sizing";
import { checkLabelText } from "./label-text";
import type { CoverageNote, LayerStyle } from "./layer-style";
import type { Layout } from "./placement";
import { readRanges } from "./text-ranges";
import { readType } from "./typography";
import { weightBinding } from "./weight-binding";

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
  /** The build's context, which says which properties a span inherits. */
  readonly context: BuildContext;
  /** The box's text color, which the label takes. */
  readonly color: ColorSpec | undefined;
  /** The lines the box clamps its label to, as `readLineClamp` in `label-wrap.ts` decides, or undefined for none. */
  readonly clamp: number | undefined;
  /** The variant's key, for errors. */
  readonly variant: string;
  /** The keys of the layers from the root down to the text layer, which the fields its reads fill name. */
  readonly path: readonly string[];
  /**
   * The characters the label shows in its own set's variant, where a composite's TEXT property value
   * gives it others in place. Figma takes a text layer's sizing from the main component and only its
   * characters from the property, so the layout follows these. Undefined for a label that shows its
   * own.
   */
  readonly variantCharacters?: string;
  /**
   * The measurement that the box's wrapping label fits on one line under the box's cap, as its
   * definition's `fitsOneLine` gives it, or undefined. A cap the build cannot read in pixels, as a
   * literal `max-width` less a padding that binds a variable, then leaves the label hugging on one
   * line, which the measurement says CSS draws.
   */
  readonly fitsOneLine: string | undefined;
  /**
   * Whether the capture measured that the box ends its one line in an ellipsis with room for its
   * first character and the ellipsis, where the browser and a Figma text both draw it.
   */
  readonly ellipsisFits: boolean;
  /**
   * The width each part of the box's row draws once mapped, by the part's style, where its frame
   * maps a fixed width with its limits folded in. Any other layer draws its `width` as declared.
   */
  readonly drawnWidths: ReadonlyMap<LayerStyle, DrawnWidth>;
  /**
   * The label's text run by run with the spans each run sits in, where a span below the box styles
   * some of it, as the box cascade's `textRuns` reads them, or undefined.
   */
  readonly runs?: readonly TextRun[] | undefined;
  /** The text the capture recorded for the label in the cell, which `label-text.ts` checks its characters against. */
  readonly captured: CapturedText;
};

/** The text properties a label reads, which a box without a label drops. */
const TEXT_PROPERTIES = [
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-decoration-line",
  "text-underline-offset",
  "text-decoration-thickness",
  "text-decoration-color",
  "text-align",
  "white-space-collapse",
  "text-wrap-mode",
  "text-wrap-style",
  "overflow-wrap",
] as const;

/** The box alignment that puts a hugging label where a definition places it, on either axis. */
const PLACED_ALONG = { start: "MIN", top: "MIN", center: "CENTER", end: "MAX", bottom: "MAX" } as const;

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

/** Why a label's element that clips its text stays unmapped where the row does not clip at its end. */
const UNCLIPPED_ELEMENT =
  "the label's element clips its text at its own edge, where a label with no room for its ellipsis hugs its text, and the row does not clip it at that edge";

/**
 * Whether a row clips at the end of its last element where that element fills the room left: the
 * row clips, and no padding or border lies between its content edge and its clip edge, so a Figma
 * frame that clips cuts the text off where the element's own clip does.
 */
function clipsAtEnd(row: LayerStyle, clips: boolean): boolean {
  const zero = (property: string): boolean => evaluateLength(row.resolved(property) ?? "0") === 0;
  return clips && ["padding-right", "border-right-width"].every(zero);
}

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
 * An element that ends in an ellipsis with no room for its first character and the ellipsis leaves
 * its label hugging its text, which runs past the element's edge, so the element's clip draws only
 * where the row clips at that edge, as {@link clipsAtEnd} says, and stays unmapped elsewhere.
 *
 * @param row - The box that holds the element, whose last layer the label is.
 * @param element - The element's style.
 * @param label - The label.
 * @param growing - The index of the row's layer that grows, or undefined for none.
 * @param edge - Whether the capture measured room in the element for its first character and an
 *   ellipsis, and whether the row clips what overflows it.
 * @returns The element as the box its label sits in, or undefined where its layout stays unmapped.
 */
export function labelElementHolder(
  row: Holder,
  element: LayerStyle,
  label: LabelDefinition,
  growing: number | undefined,
  edge: { readonly ellipsisFits: boolean; readonly rowClips: boolean }
): Holder | undefined {
  const { layout } = row;
  const ends =
    layout.flex &&
    layout.direction === "HORIZONTAL" &&
    (layout.justify === "unset" || layout.justify === "MIN") &&
    growing === undefined &&
    FROM_START.has(normalizeCss(element.resolved("text-align") ?? ""));
  const fills = row.sizing.horizontal.kind !== "hug";
  const capped = ends && !fills && widthCapInside(row, row.layers.findIndex(isLabel)).kind !== "none";
  if (!ends || capped) {
    for (const property of ELEMENT_LAYOUT) {
      element.mark(property, "unmapped", capped ? CAPPED_ELEMENT : UNENDED, []);
    }
    return undefined;
  }
  const unclipped =
    fills && endsInEllipsis(element) && !edge.ellipsisFits && !clipsAtEnd(row.style, edge.rowClips);
  element.read(
    "overflow",
    (value) => value,
    (): CoverageNote => {
      if (unclipped) {
        return { outcome: "unmapped", detail: UNCLIPPED_ELEMENT };
      }
      return fills
        ? { outcome: "literal", detail: "the label's element clips its text at the room the row leaves it" }
        : { outcome: "dropped", detail: NEVER_OVERFLOWS };
    },
    unclipped ? [] : element.feed("sizing")
  );
  return {
    style: element,
    layout: TEXT_BLOCK,
    sizing: { horizontal: fills ? { kind: "fill" } : { kind: "hug" }, vertical: { kind: "hug" } },
    limits: NO_LIMITS,
    extent: { horizontal: undefined, vertical: undefined },
    layers: [{ kind: "label", name: label.name, share: UNREAD_SHARE, style: undefined, tag: undefined }],
    widthCap: { kind: "none" },
    // A row that hugs with nothing bounding it lays the element out at its max-content width.
    unbounded: hugsUncapped(row),
    // The rule above decides the element's sizing.
    widthKnown: true,
  };
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
export function mapLabel(holder: Holder, label: PlacedLabel, scope: LabelScope): MappedLabel {
  const { style } = holder;
  const { color, variables, path } = scope;
  const { fontFamily, fontSize, lineHeight, fontWeight, letterSpacing } = readType(style, variables, path);
  // A variable weight binds the layer's `fontWeight`, which picks its upright face in each mode.
  const weight = fontWeight?.kind === "variable" ? weightBinding(fontWeight.variable, variables) : undefined;
  const italic = normalizeCss(style.resolved("font-style") ?? "normal") === "italic";
  if (fontWeight?.kind === "variable" && (weight === undefined || italic)) {
    throw new KitUnmappable({
      message: `${scope.variant}: the label's weight binds ${fontWeight.variable.name}, whose weights name no upright face the kit knows`,
    });
  }
  const decoration = readDecoration(style, fontSize, variables, path);
  if (fontFamily === undefined || fontSize === undefined || lineHeight === undefined || color === undefined) {
    throw new KitUnmappable({
      message: `${scope.variant}: the label needs a font family, size, line height and color`,
    });
  }
  const lines = label.placement?.lines;
  const characters = labelCharacters(label, scope.cell);
  checkLabelText(style, characters, scope.captured, scope);
  const ranges =
    scope.runs === undefined
      ? []
      : readRanges(
          scope.runs,
          style,
          color,
          decoration.underline,
          characters,
          {
            variables,
            context: scope.context,
            // A label with a line of its own leaves a span's line unmapped.
            underline:
              decoration.underline === undefined && decoration.strikethrough !== true
                ? (span) => readDecoration(span, fontSize, variables, path).underline
                : undefined,
          },
          scope
        );
  // A TEXT write on an instance writes its characters, which on 2026-11-19 gave every character the
  // first character's fill, even where the text stayed the same.
  if (ranges.length > 0 && label.textProperty !== undefined) {
    throw new KitUnmappable({
      message: `${scope.variant}: the label ${path.join("/")} styles runs of its text and links the ${label.textProperty} property, whose writes give every character the first character's style`,
    });
  }
  const layout: LabelLayout =
    lines === undefined
      ? readLabelLayout(
          holder,
          label,
          { shown: characters, built: scope.variantCharacters },
          scope.clamp,
          scope.variant,
          path,
          scope.fitsOneLine,
          scope.ellipsisFits,
          scope.drawnWidths
        )
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
    fontStyle:
      weight?.faces[0] ??
      readFaceStyle(
        style,
        { family: fontFamily, upright: fontWeight?.kind === "literal" ? fontWeight.style : "Regular" },
        path
      ),
    fontSize,
    lineHeight,
    color,
    ...decoration,
    sizing: layout.sizing,
    align: readTextAlign(style, fills ? label.placement : undefined, path),
    truncation: layout.truncation,
  };
  const block = blockPlace(holder, label, layer);
  const colored = ranges.length === 0 ? layer : { ...layer, ranges };
  const weighted = weight === undefined ? colored : { ...colored, weight };
  const wraps = layout.maxWidth === undefined ? weighted : { ...weighted, maxWidth: layout.maxWidth };
  const placed = placeInBox(holder, label.placement);
  return {
    layer: letterSpacing === undefined ? wraps : { ...wraps, letterSpacing },
    primaryAlign: layout.packsAtStart ? "MIN" : (block ?? placed.primaryAlign),
    counterAlign: placed.counterAlign,
  };
}

/** The box alignment that puts a hugging text where its lines' alignment would set them across a box. */
const ALONG_OF = { LEFT: "MIN", CENTER: "CENTER", RIGHT: "MAX" } as const;

/**
 * Where a block box puts its own text that hugs its width inside a width of the box's own, as a
 * `<pre>` holds lines that never wrap. A block container sets each line box across its content width
 * and places its text in it by `text-align` (CSS Text 3 §6.1), so the text sits where its lines' own
 * alignment says, which the frame's alignment along its row draws. `start` and `end` have resolved
 * against the lines' `direction` by then, so a right-to-left `start` sits at MAX. A flex or grid box places its text
 * as an item, and a box that hugs its width has no room to place the text in.
 *
 * @returns The frame's alignment along its row, or undefined where the box places the text otherwise.
 */
function blockPlace(holder: Holder, label: PlacedLabel, layer: TextLayerSpec): CounterAlignSpec | undefined {
  const { layout, sizing } = holder;
  const placesLines =
    textItem(holder) === undefined &&
    !layout.blocks &&
    layout.direction === "HORIZONTAL" &&
    sizing.horizontal.kind !== "hug" &&
    layer.sizing.horizontal.kind === "hug" &&
    label.placement === undefined;
  return placesLines ? ALONG_OF[layer.align.horizontal] : undefined;
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
    throw new KitUnmappable({
      message: `${variant}: the space before ${label.name} draws as its box's gap only between one start icon and the label, at a literal size in Roboto ${[...ROBOTO_SPACE.keys()].join(" or ")}`,
    });
  }
  return { kind: "literal", value: (advance / ROBOTO_UNITS_PER_EM) * layer.fontSize.value };
}
