/**
 * How a box's label sizes and truncates: whether it hugs or fills its box's width, the flex rows
 * where its text item fills the room before the last layer, the refusals where a flex or grid item
 * cannot, the max width the boxes around it cap, its ellipsis and line clamp, the lines a native
 * control sets itself, and the white space and word breaking declarations that settle with that
 * layout.
 * `label-layout.ts` reads the label's layout here.
 */

import { hugsUncapped, listNames, widthCapInside } from "./box-sizing";
import type { Holder, RowLayer, WidthCap } from "./box-sizing";
import { KitUnmappable } from "./build-errors";
import type { LabelDefinition } from "./component-spec";
import { evaluateLength, normalizeCss } from "./css-values";
import { DECLARED_WIDTH, keepsOwnSize, widthHeldBy } from "./flex-item-width";
import type { DrawnWidth, HoldingDeclaration } from "./flex-item-width";
import { HUGGING_TEXT } from "./kit-spec";
import type { NumberSpec, TextLayerSpec, TextSizingSpec } from "./kit-spec";
import { LINES_WHERE, linesAcross } from "./label-alignment";
import type { Across, PlacedLabel, TextPlacement } from "./label-alignment";
import { inertClamp, neverWraps, wraps } from "./label-wrap";
import type { CoverageNote, LayerStyle } from "./layer-style";

/** Where a flex box's alignment puts a layer across, named as text alignment names the place. */
const PLACE_OF = { MIN: "LEFT", CENTER: "CENTER", MAX: "RIGHT" } as const;

/** How a box's placement of a layer reads in a coverage detail. */
const PLACED_WHERE = { LEFT: "at the start", CENTER: "in the center", RIGHT: "at the end" } as const;

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
 * The other layer of a flex row whose text item draws as a text that fills the room that layer leaves:
 * the label is the first of two layers that the row spaces between its ends, it sets its lines from
 * the start, and the other layer is as wide as a length says, or keeps its own width, as a Command
 * row's Kbd group shortcut does, which a Figma frame that hugs draws. The item then sits at the start,
 * shrinks to the room the other layer and the row's gap leave and wraps there (CSS Flexbox 1 §9.7),
 * and the other layer ends the row, as a vertical Navigation menu trigger holds its title and caret.
 * The gap is the least space between them under any distributed alignment (CSS Box Alignment 3 §8),
 * and a filling text leaves no room to space out, so the row packs its layers at the start with its
 * gap between them, which draws what CSS draws. On 2026-10-23 a real file kept no gap under
 * SPACE_BETWEEN beside a filling text: the text took the whole room and met the caret (PV). The
 * builder measures no text, so a label whose longest word is wider than that room draws wrapped in
 * Figma, where CSS keeps the word whole and pushes the other layer out (CSS Flexbox 1 §4.5).
 *
 * A label a TEXT property sets fills here whatever its sample's word count, since a designer types
 * longer labels into it. A one-word sample that fits draws the same filling or hugging, and a longer
 * label of several words wraps between them inside the room in CSS and Figma, as Chromium showed for the
 * Dropdown menu sub trigger on 2026-11-19, where `shrink-0` keeps the caret at its width. One word
 * wider than the room is the known limit above.
 *
 * This function finds the row's shape. The fill also needs the other layer to keep the width it
 * draws, as {@link heldAfter} reads it apart. Where the build cannot establish that, a Figma layer
 * keeps its size where CSS may not, so the label's sizing stays unmapped, with no one-word sample
 * hugging instead.
 *
 * @returns The other layer, or undefined where the row has another shape.
 */
function spacedFirst(holder: Holder, across: Across): RowLayer | undefined {
  const { layout, layers } = holder;
  const [first, other] = layers;
  return layout.direction === "HORIZONTAL" &&
    layout.justify === "SPACE_BETWEEN" &&
    layers.length === 2 &&
    first !== undefined &&
    isLabel(first) &&
    across === "LEFT"
    ? other
    : undefined;
}

/** Whether a layer of a box's flow is the box's own label. */
export function isLabel(layer: RowLayer): boolean {
  return layer.kind === "label";
}

/**
 * The elements whose width does not follow a `width` they leave unset, so a Figma frame that hugs
 * what it holds can draw another width: form controls and replaced elements, which take an
 * intrinsic size (CSS Sizing 3 §5.1), and a `<button>`, whose user-agent style can size it.
 */
const INTRINSIC: ReadonlySet<string> = new Set([
  "input",
  "select",
  "textarea",
  "button",
  "meter",
  "progress",
  "img",
  "video",
  "canvas",
  "iframe",
  "object",
  "embed",
]);

/** Whether a margin along a row takes no room: unset or a length of 0. */
function takesNoRoom(value: string | undefined): boolean {
  return value === undefined || evaluateLength(value) === 0;
}

/**
 * The declarations that hold the layer after a spaced row's label at the width that layer draws,
 * however the label wraps, where the build can establish that it keeps that width. The layer's
 * share must be a length or its own width, and `widthHeldBy` in `flex-item-width.ts` must read its
 * flex, limits and box as holding it there. The row must not wrap, since a wrapped row sets each
 * layer on a line of its own (CSS Flexbox 1 §9.3). The layer must take no margin along the row but
 * the `auto` start margin that ends the row with it, since a margin of a length moves the room the
 * label has, and an `auto` end margin sets the layer right after a short label (§8.1). A control or
 * replaced element must set a literal `width`, since it otherwise takes its own intrinsic width. A
 * part's `flex` that moves its size stays unmapped where the box reads its growth, so the label
 * does not fill beside it either.
 *
 * @param row - The row's style.
 * @param after - The layer after the label.
 * @param drawn - The width the layer draws, as the box mapping reads it.
 * @returns The declarations, or undefined where the build cannot establish that the layer keeps
 *   the width it draws.
 */
function heldAfter(
  row: LayerStyle,
  after: RowLayer,
  drawn: DrawnWidth
): readonly HoldingDeclaration[] | undefined {
  const { style, share, tag } = after;
  const width = style?.resolved("width");
  const fits =
    style !== undefined &&
    (share.kind === "pixels" || share.kind === "hugs") &&
    ["", "nowrap"].includes(normalizeCss(row.resolved("flex-wrap") ?? "")) &&
    (normalizeCss(style.resolved("margin-left") ?? "") === "auto" ||
      takesNoRoom(style.resolved("margin-left"))) &&
    takesNoRoom(style.resolved("margin-right")) &&
    !(after.kind === "part" && style.has("flex") && !keepsOwnSize(style)) &&
    (tag === undefined ||
      !INTRINSIC.has(tag) ||
      (width !== undefined && evaluateLength(width) !== undefined));
  return fits ? widthHeldBy(style, drawn) : undefined;
}

/**
 * Whether a flex row's text item draws as a text that fills the room before the row's last layer,
 * whose auto start margin takes the free space (CSS Flexbox 1 §8.1), as `readAutoStart` in
 * `auto-margins.ts` reads it for three or more layers: the label sits right before that layer and sets its
 * lines from the start. The label then paints nothing past its text, so a fill draws what CSS draws
 * at any length of text that fits.
 */
function fillsBeforeMargin(holder: Holder, across: Across): boolean {
  const { layout, layers } = holder;
  return (
    layout.direction === "HORIZONTAL" &&
    layout.labelFills === true &&
    layers.length > 2 &&
    layers.at(-2)?.kind === "label" &&
    across === "LEFT"
  );
}

/**
 * Why a label first of a spaced row's two layers keeps its sizing unmapped where the build cannot
 * establish that the layer after it keeps the width it draws, as {@link heldAfter} reads it. A Figma
 * layer beside a filling text keeps its size, and CSS may size that layer otherwise.
 *
 * @param after - The name of the layer after the label.
 */
function narrowing(after: string): Refusal {
  return {
    anchor: "display",
    detail: `the build could not establish that ${after} keeps its drawn width when the label wraps (CSS Flexbox 1 §9.7), so the label's sizing stays unmapped`,
  };
}

/** What a declaration of the layer after the label notes where it keeps that layer's width, so the label fills. */
const KEEPS_AFTER: CoverageNote = {
  outcome: "literal",
  detail:
    "the layer keeps the width it draws however the label wraps (CSS Flexbox 1 §9.7), so the label before it fills the room it and the row's gap leave",
};

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
  const others = layers.flatMap((layer) => (isLabel(layer) ? [] : [layer.name]));
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

/** A label that fills its box's width, its height following its lines. */
const FILLING: TextSizingSpec = { horizontal: { kind: "fill" }, vertical: { kind: "hug" } };

/** Why a hugging box drops the declarations that cut its label off. */
export const NEVER_OVERFLOWS = "the box hugs the label, so it never overflows";

/**
 * The `text-wrap-style` values that choose where a wrapping text breaks its lines (CSS Text 4 §6.3):
 * `balance` evens out their lengths, and `pretty` keeps a short word off the last one.
 */
const EVENED_LINES = new Set(["balance", "pretty"]);

/**
 * What `white-space-collapse` does to a label's characters: `collapse`, its initial value, folds runs
 * of white space and line breaks into one space, which changes nothing in characters that hold none, so
 * it drops. `preserve` keeps them as written, as a Figma text does, so it drops too, except for a
 * label whose markup starts with a space its characters leave out (`leadingSpace`). Characters that
 * hold a run of white space under `collapse`, or another value, stay unmapped.
 *
 * @param style - The label's box.
 * @param characters - The characters the label shows.
 * @param leadingSpace - Whether the label's markup starts with a space its characters leave out.
 */
function readWhiteSpaceCollapse(style: LayerStyle, characters: string, leadingSpace: boolean): void {
  style.read(
    "white-space-collapse",
    (written) => {
      const collapse = normalizeCss(written);
      // A sample whose markup starts with a space its characters leave out would keep it under `preserve`.
      if (collapse === "preserve") {
        return leadingSpace ? undefined : PRESERVED;
      }
      return collapse === "collapse" && !/\s\s|[\t\n\r]|^\s|\s$/.test(characters) ? COLLAPSED : undefined;
    },
    (detail) => ({ outcome: "dropped", detail }),
    []
  );
}

/** Why `white-space-collapse: collapse` drops on characters with no white space to fold. */
const COLLAPSED = "the characters hold no run of white space or line break to collapse";

/**
 * Why `white-space-collapse: preserve`, which `whitespace-pre` sets, drops: it keeps every space and
 * line break as written (CSS Text 4 §3.1), as a Figma text draws its characters.
 */
const PRESERVED = "a Figma text keeps every space and line break as written, as `preserve` does";

/**
 * Whether a box ends its one line in an ellipsis, as `truncate` makes it: it hides its overflow,
 * keeps its text on one line and sets `text-overflow: ellipsis` (CSS Overflow 3 §4.2).
 */
export function endsInEllipsis(style: LayerStyle): boolean {
  const value = (property: string): string => normalizeCss(style.resolved(property) ?? "");
  return (
    value("overflow") === "hidden" &&
    value("text-wrap-mode") === "nowrap" &&
    value("text-overflow") === "ellipsis"
  );
}

/**
 * Read the `overflow-wrap` a label's text takes, set on its box or inherited from a box around it,
 * which breaks a word only where the word would overflow its line (CSS Text 3 §5.5). A text that
 * hugs its width, with no `maxWidth` of its own and nothing bounding the width CSS gives its box, sets
 * each line at its max-content width, where every word fits, so the declaration drops. Any other text
 * can set a line narrower than a word, so it stays unmapped. Every label reads it, so a box with no
 * text of its own that passes it down settles with what its texts make of it. A text of fixed or
 * filling width under `break-word` or `anywhere`, as a `<textarea>`'s default style sets, breaks a
 * word wider than its line, as a Figma text box of that width wraps one (FW1 on #522, a real file on
 * 2026-11-20), so it maps.
 *
 * @param holder - The box the label sits in.
 * @param layout - The label's sizing and the width it wraps at.
 */
export function readOverflowWrap(holder: Holder, layout: LabelLayout): void {
  const fits =
    layout.sizing.horizontal.kind === "hug" && layout.maxWidth === undefined && hugsUncapped(holder);
  const setWidth = layout.sizing.horizontal.kind === "fixed" || layout.sizing.horizontal.kind === "fill";
  holder.style.read(
    "overflow-wrap",
    (value) => value,
    (value): CoverageNote =>
      fits
        ? {
            outcome: "dropped",
            detail:
              "the text hugs its width and nothing bounds the width CSS gives it, so no line is narrower than a word, and no word overflows to break",
          }
        : setWidth && BREAKS_WORDS.has(normalizeCss(value))
          ? {
              outcome: "literal",
              detail: "the text breaks a word wider than its line, as a Figma text of that width wraps it",
            }
          : {
              outcome: "unmapped",
              detail: "the text can set a line narrower than a word, and the builder measures no word",
            },
    []
  );
}

/** The `overflow-wrap` values that break a word wider than its line (CSS Text 3 §5.5). */
const BREAKS_WORDS: ReadonlySet<string> = new Set(["break-word", "anywhere"]);

/**
 * Why an ellipsis stays unmapped where the box has no room for its first character and the ellipsis:
 * Chromium draws the first character and the ellipsis clipped at the box, and a Figma text that
 * ends in an ellipsis draws the ellipsis alone.
 */
const NARROW_ELLIPSIS =
  "the box has no room for its first character and the ellipsis, where Chromium draws both clipped at the box and a Figma text draws the ellipsis alone";

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
 * @param characters - The text the label shows in the cell, and the text its own set's variant shows
 *   where a composite's TEXT property value gives it this one in place. A text with no break
 *   opportunity keeps its own width only where the variant's does too, so it takes the variant's
 *   filling layout otherwise. In a row {@link spacedFirst} reads, a label a TEXT property sets fills
 *   whatever its text. A variant that keeps its text at its own width, given a text that can
 *   wrap, lays out another way, which the instance diff leaves unmapped.
 * @param variant - The variant's key, for the error.
 * @throws When a box around a wrapping label caps its width at a length that is no literal, which
 *   the label's `maxWidth` needs.
 */
export function readLabelLayout(
  holder: Holder,
  label: PlacedLabel,
  characters: { readonly shown: string; readonly built: string | undefined },
  lines: number | undefined,
  variant: string,
  path: readonly string[],
  fitsOneLine: string | undefined,
  ellipsisFits: boolean,
  drawnWidths: ReadonlyMap<LayerStyle, DrawnWidth>
): LabelLayout {
  const { style, sizing } = holder;
  const value = (property: string): string => normalizeCss(style.resolved(property) ?? "");
  const wrapping = wraps(value("text-wrap-mode"));
  const truncates = endsInEllipsis(style);
  // `text-overflow` applies to block containers (CSS Overflow 3 §4.2). A flex or grid box sets its
  // own text as an anonymous item, which it clips with no ellipsis.
  const item = textItem(holder);
  // Chromium keeps a line's first character however narrow the box and sets the ellipsis after it,
  // both clipped at the box, where a Figma text that ends in an ellipsis drops every character that
  // does not fit beside it. Only a box the capture measured with room for both draws the same.
  const blockTruncates = truncates && item === undefined;
  const narrow = blockTruncates && !ellipsisFits;
  const ellipsis = blockTruncates && ellipsisFits;
  const maxLines = ellipsis ? 1 : lines;
  const definite = sizing.horizontal.kind !== "hug";
  const cap: WidthCap =
    !definite && wrapping && !ellipsis && lines === undefined
      ? widthCapInside(holder, holder.layers.findIndex(isLabel))
      : { kind: "none" };
  if (cap.kind === "unread" && holder.limits.maxWidth === undefined) {
    throw new KitUnmappable({
      message: `${variant}: a box around ${label.name} caps its width, and the build cannot read in pixels the room the label has under it`,
    });
  }
  if (cap.kind === "pixels" && cap.value <= 0) {
    throw new KitUnmappable({
      message: `${variant}: a box around ${label.name} caps its width at ${cap.value}px, and Figma takes only a positive max width`,
    });
  }
  // A measurement that the label fits on one line under a cap the build cannot read keeps it hugging.
  const measured = cap.kind === "unread" && fitsOneLine !== undefined;
  const oneLine = measured
    ? `the box hugs the label on one line: ${fitsOneLine}`
    : "the box hugs the label on one line";
  const capped =
    !definite &&
    holder.limits.maxWidth !== undefined &&
    (ellipsis || lines !== undefined || (cap.kind === "unread" && !measured));
  const maxWidth = cap.kind === "pixels" ? cap.value : undefined;
  const across = linesAcross(style, label.placement);
  const placed =
    definite && wrapping && item !== undefined ? refuseItem(holder, item, label, across) : undefined;
  // The item never shrinks below its one line, so it sits at its own width, which a hugging text draws.
  // In place, a one-word text keeps its own width only where its variant's text does too, and takes
  // the variant's filling layout otherwise, which draws it as CSS does. A label a TEXT property sets
  // in a spaced row fills instead, as `spacedFirst` says, since a designer may type several words.
  const after = !capped && placed !== undefined && item === "flex" ? spacedFirst(holder, across) : undefined;
  const spacedRow = after !== undefined;
  // A typed label there never hugs as one word, so beside a layer that may change width it stays unmapped.
  const holding =
    after?.style === undefined
      ? undefined
      : heldAfter(style, after, drawnWidths.get(after.style) ?? DECLARED_WIDTH);
  const ownWidth =
    placed !== undefined &&
    item === "flex" &&
    !(spacedRow && label.textProperty !== undefined) &&
    neverWraps(style, characters.shown) &&
    (characters.built === undefined || neverWraps(style, characters.built));
  const beforeMargin = definite && !capped && item === "flex" && fillsBeforeMargin(holder, across);
  const keepsAfter = holding !== undefined && !ownWidth;
  const spaced = beforeMargin || keepsAfter;
  const refusal = capped
    ? CAPPED
    : ownWidth || spaced
      ? undefined
      : after !== undefined
        ? narrowing(after.name)
        : placed;
  if (keepsAfter && after?.style !== undefined) {
    for (const property of holding) {
      style.readPlacing(
        after.style,
        property,
        (written) => written,
        () => KEEPS_AFTER,
        style.feed("sizing", path)
      );
    }
  }
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
    if (narrow) {
      return { outcome: "unmapped", detail: NARROW_ELLIPSIS };
    }
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

  readWhiteSpaceCollapse(style, characters.shown, label.leadingSpace === true);
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
        detail: fills ? "the label wraps at the box's width" : oneLine,
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
        detail: ownWidth ? "the text never wraps, so the label keeps its own width" : oneLine,
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
export type LabelLayout = Pick<TextLayerSpec, "sizing" | "truncation"> & {
  /** The width a hugging label wraps at, or undefined for none. */
  readonly maxWidth: NumberSpec | undefined;
  /**
   * Whether the label fills the room its row's other layer and gap leave, as {@link spacedFirst}
   * and {@link heldAfter} decide, so the row packs its layers at the start with its gap between them.
   */
  readonly packsAtStart: boolean;
};

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
 *   `white-space`, so only `normal` and the browser's default `pre-wrap` map, which keeps the
 *   characters as written, as a Figma text draws them, and every other value stays unmapped, as do
 *   `text-overflow` and `-webkit-line-clamp`, which this reader leaves unread.
 *
 * @param variant - The variant's key, for the error.
 * @throws When the box hugs its width. A control with no width of its own takes an intrinsic width
 *   from its `size` or `cols`, which no Figma field holds.
 */
export function readNativeLines(
  holder: Holder,
  lines: NonNullable<TextPlacement["lines"]>,
  variant: string,
  path: readonly string[]
): Pick<TextLayerSpec, "sizing" | "truncation"> {
  if (holder.sizing.horizontal.kind === "hug") {
    throw new KitUnmappable({
      message: `${variant}: ${NATIVE_LINES[lines]}, so its box needs a fixed or filling width`,
    });
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
      (written) => (["collapse", "preserve"].includes(normalizeCss(written)) ? written : undefined),
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

/**
 * The kind of item a box makes of its own text: `flex` or `grid` where the box lays its text out as
 * an anonymous item, or undefined for a block container, which sets the text in line boxes across
 * its content width.
 */
export function textItem(holder: Holder): "flex" | "grid" | undefined {
  if (holder.layout.flex) {
    return "flex";
  }
  const display = normalizeCss(holder.style.raw("display") ?? "");
  return display === "grid" || display === "inline-grid" ? "grid" : undefined;
}
