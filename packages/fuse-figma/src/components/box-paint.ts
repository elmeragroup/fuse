/**
 * How a box paints, read from its style: its fill, or the picture it shows, its stroke, its drop
 * shadows, and an outline that paints nothing. `box-mapping.ts` maps a box's layout and layers,
 * and asks this module for the box's paint and for the coverage note of a color it reads itself,
 * such as a text color.
 */
import { createHash } from "node:crypto";

import { borderLonghands, borderWidthLength } from "../capture/border-shorthands.ts";
import { KitUnmappable } from "./build-errors";
import {
  describeNumber,
  evaluateLength,
  normalizeCss,
  readColor,
  readNumber,
  readShadows,
} from "./css-values";
import type { VariableIndex } from "./css-values";
import type {
  BoxSpec,
  ColorSpec,
  EverySideStroke,
  ImagePaintSpec,
  NumberSpec,
  ShadowSpec,
  SideStroke,
  StrokeSide,
  VariableRef,
} from "./kit-spec";
import type { CoverageNote, Feed, LayerStyle } from "./layer-style";

/**
 * What a color read from CSS became, for the coverage table.
 *
 * @param spec - The color.
 * @returns Bound with the variable's collection and name, or literal with its channels.
 */
export function describeColor(spec: ColorSpec): CoverageNote {
  if (spec.kind === "variable") {
    return { outcome: "bound", detail: `${spec.variable.collection} / ${spec.variable.name}` };
  }
  const { r, g, b, a } = spec.color;
  return {
    outcome: "literal",
    detail: `rgba(${[r, g, b].map((channel) => Math.round(channel * 255)).join(", ")}, ${a})`,
  };
}

/** A box's paint: its fill, its stroke, its drop shadows and the blur it draws behind it. */
export type BoxPaint = Pick<BoxSpec, "fill" | "stroke" | "shadows" | "backgroundBlur">;

/**
 * Whether a box paints anything of its own: a fill, a stroke, a shadow, or a background blur, which
 * blurs what lies behind the whole border box, its padding included.
 */
export function paintsAnything(paint: BoxPaint): boolean {
  return (
    paint.fill !== undefined ||
    paint.stroke !== undefined ||
    paint.shadows.length > 0 ||
    paint.backgroundBlur !== undefined
  );
}

/**
 * Read a `backdrop-filter` that blurs what lies behind the box, `blur(Npx)` and nothing else, as the
 * overlay scrim's `backdrop-blur-xs` writes `blur(4px)` among Tailwind's empty filter slots, as a
 * Figma background blur. CSS's `blur()` takes the Gaussian's standard deviation (Filter Effects 1
 * §12.2) and Figma's blur radius counts twice that, so the radius is twice the length: a real file's
 * BACKGROUND_BLUR of radius 8 blurred a black and white step to a Gaussian of σ about 3.45 with tails
 * near ±8px, as CSS's `blur(4px)` does at σ 4, and read the effect back exactly (W5-P13).
 * `-webkit-backdrop-filter`, Safari's prefixed name, carries the same blur. Any other filter stays
 * unmapped.
 *
 * @returns The radius, or undefined where the box blurs nothing behind it.
 */
function readBackgroundBlur(reader: LayerStyle): NumberSpec | undefined {
  const radius = reader.read(
    "backdrop-filter",
    (value) => {
      const length = /^blur\((\d*\.?\d+)px\)$/.exec(normalizeCss(value))?.[1];
      return length === undefined ? undefined : ({ kind: "literal", value: Number(length) * 2 } as const);
    },
    (spec) => ({
      outcome: "literal",
      detail: `a background blur of ${spec.value}, twice the CSS blur's ${spec.value / 2}px standard deviation, as Figma's blur radius counts it (W5-P13)`,
    }),
    reader.feed("backgroundBlur")
  );
  reader.read(
    "-webkit-backdrop-filter",
    (value) => (radius === undefined ? undefined : value),
    () => ({ outcome: "literal", detail: "the same blur under Safari's prefixed name" }),
    []
  );
  return radius;
}

/**
 * Read how a box paints. A box that shows a picture fills with it, and any other box with its
 * background. Reading the paint also drops an outline that paints nothing.
 *
 * @param reader - The box's style.
 * @param image - The bytes of the picture the box shows, or undefined for a box that shows none.
 * @param variables - The synced variables a paint can bind.
 * @param variant - The cell's variant key, for the error.
 * @param collapsed - Whether the box is a table row whose table collapses its borders and whose
 *   borders no box sharing their edges contests, as the capture read it, so its border takes no
 *   room, on every side or on some, as {@link COLLAPSED} says. A row or row group without it leaves
 *   its border unmapped, as {@link unownedRowBorder} says.
 * @returns The box's fill, stroke and shadows, and the border's widths where the fill draws inside
 *   the border on a layer of its own, as {@link readBackgroundClip} says.
 * @throws When a box that shows a picture sets no `object-fit`, as {@link readImage} says.
 */
export function readPaint(
  reader: LayerStyle,
  image: (() => Uint8Array) | undefined,
  variables: VariableIndex,
  variant: string,
  collapsed: boolean
): { readonly paint: BoxPaint; readonly paddingBox?: PaddingBoxInsets } {
  const borders = sideBorders(reader, variables);
  // A side that may draw: one of a width other than 0, or of a width that does not map.
  const draws = BORDER_SIDES.some((side) => borders[side].used !== 0);
  const border = unownedRowBorder(reader, draws, collapsed)
    ? undefined
    : readBorder(reader, variables, collapsed, borders);
  const cleared = readClearOutline(reader, variables);
  // A box holds one stroke, so its border keeps it, even one of no width.
  const bordered = !BORDER_SIDES.every((side) => unsetSide(borders[side]));
  const stroke = bordered || cleared ? border : readInsideOutline(reader, variables);
  // CSS paints the first shadow of `box-shadow` on top (CSS Backgrounds 3 §7.1), and Figma paints a
  // later effect above an earlier one (PE2), so the spec lists the shadows in Figma's order.
  const shadows = readShadowStack(reader, variables).toReversed();
  const fill =
    image === undefined
      ? reader.read(
          "background-color",
          (value) => readFill(value, variables),
          describeFill,
          reader.feed("fill")
        )
      : readImage(reader, image, variant);
  const shown = fill === NO_FILL ? undefined : fill;
  const paddingBox = readBackgroundClip(reader, draws ? border : NO_BORDER, borders, shown, variables);
  const paint = { fill: shown, stroke, shadows };
  const backgroundBlur = readBackgroundBlur(reader);
  const blurred = backgroundBlur === undefined ? paint : { ...paint, backgroundBlur };
  return paddingBox === undefined ? { paint: blurred } : { paint: blurred, paddingBox };
}

/**
 * Read the background an ancestor paints behind a root that paints none, as the root's fill. The
 * root shows it across its box, since the ancestor's box holds the root's (CSS 2.1 Appendix E).
 *
 * @param backdrop - The ancestor's style, whose reads fill the root's fields.
 * @param root - The root's style.
 * @param variables - The synced variables the color can bind.
 * @returns The fill, or undefined where the ancestor paints no background.
 */
export function readBackdrop(
  backdrop: LayerStyle,
  root: LayerStyle,
  variables: VariableIndex
): ColorSpec | undefined {
  if (!backdrop.has("background-color")) {
    return undefined;
  }
  const fill = backdrop.read(
    "background-color",
    (value) => readFill(value, variables),
    (read) => {
      const { outcome, detail } = describeFill(read);
      return {
        outcome,
        detail: `${detail}, which the ancestor paints behind the root, so the root shows it across its box`,
      };
    },
    root.feed("fill")
  );
  return fill === NO_FILL ? undefined : fill;
}

/** A background that paints nothing, which the root writes as no fill. */
const NO_FILL = "no fill";

/**
 * Read a background as the root's fill. A literal color at alpha 0, such as `transparent`,
 * paints nothing in CSS, so it becomes no fill, as an unset background does. The plugin then
 * gives a root that casts a spread shadow its clear fill, which Figma counts and an alpha-0
 * fill it does not.
 */
function readFill(value: string, index: VariableIndex): ColorSpec | typeof NO_FILL | undefined {
  const color = readColor(value, index);
  return color?.kind === "literal" && color.color.a === 0 ? NO_FILL : color;
}

function describeFill(fill: ColorSpec | typeof NO_FILL): CoverageNote {
  return fill === NO_FILL
    ? { outcome: "literal", detail: "no fill, since a transparent background paints nothing" }
    : describeColor(fill);
}

/**
 * Read an image box's fill: the picture it shows, scaled as its `object-fit` says. `cover` scales
 * the picture to cover the box and crops what overflows, which an image paint at FILL draws, and
 * any other fit stays unmapped and leaves the box without a fill. The picture covers the box, so
 * the build reads no `background-color` under it, and one the box sets stays unmapped.
 *
 * @param image - The picture's bytes.
 * @param variant - The cell's variant key, for the error.
 * @returns The image paint, or undefined where the fit does not map.
 * @throws When the box sets no `object-fit`, whose initial `fill` stretches the picture to the box,
 *   which no image paint draws.
 */
function readImage(reader: LayerStyle, image: () => Uint8Array, variant: string): ImagePaintSpec | undefined {
  if (!reader.has("object-fit")) {
    throw new KitUnmappable({
      message: `${variant}: a box that shows an image needs object-fit: cover, which an image paint at FILL draws`,
    });
  }
  const scaleMode = reader.read(
    "object-fit",
    (value) => (normalizeCss(value) === "cover" ? ("FILL" as const) : undefined),
    () => ({
      outcome: "literal",
      detail: "the image covers the box and crops what overflows, an image paint at FILL",
    }),
    reader.feed("fill")
  );
  if (scaleMode === undefined) {
    return undefined;
  }
  const bytes = image();
  // Figma names a stored image by the SHA-1 of its bytes (P9b), so the plugin compares a held paint
  // with this hash and stores no image to learn it.
  return {
    kind: "image",
    bytes: Buffer.from(bytes).toString("base64"),
    hash: createHash("sha1").update(bytes).digest("hex"),
    scaleMode,
  };
}

/**
 * Drop an outline that paints nothing: a literal color at alpha 0, as `outline-transparent` sets,
 * the way {@link readFill} reads a transparent background as no fill. A meter's bar keeps such an
 * outline for forced-colors mode, where the browser paints it in a system color. Any other outline
 * is left to {@link readInsideOutline}.
 *
 * @returns Whether the box's outline paints nothing.
 */
function readClearOutline(reader: LayerStyle, index: VariableIndex): boolean {
  const color = readColor(reader.resolved("outline-color") ?? "", index);
  if (color?.kind !== "literal" || color.color.a !== 0) {
    return false;
  }
  for (const property of ["outline-style", "outline-width", "outline-offset", "outline-color"]) {
    reader.read(
      property,
      (value) => value,
      () => ({ outcome: "dropped", detail: "the outline is transparent, so it paints nothing" }),
      []
    );
  }
  return true;
}

/**
 * Read an outline drawn inside the box as the box's stroke. An outline lies outside the border edge,
 * `outline-offset` from it (CSS Basic UI 4 §5), so a solid outline whose offset is minus its literal
 * width lies over the box's outer pixels, where a Figma inside stroke of that weight lies, as Item's
 * image media frames its picture with `outline-1 -outline-offset-1`. Any other outline stays unread,
 * and so unmapped, since it lies outside the box, where no stroke of the box draws.
 *
 * @returns The stroke, or undefined where the box sets no outline that lies inside it.
 */
function readInsideOutline(reader: LayerStyle, variables: VariableIndex): EverySideStroke | undefined {
  const width = evaluateLength(reader.resolved("outline-width") ?? "");
  const offset = evaluateLength(reader.resolved("outline-offset") ?? "");
  const color = readColor(reader.resolved("outline-color") ?? "", variables);
  const solid = normalizeCss(reader.resolved("outline-style") ?? "") === "solid";
  if (!solid || width === undefined || width <= 0 || offset !== -width || color === undefined) {
    return undefined;
  }
  const inside = (detail: string) => () => ({ outcome: "literal" as const, detail });
  const stroke = reader.feed("stroke");
  reader.read("outline-style", (value) => value, inside("a solid inside stroke"), stroke);
  reader.read("outline-width", (value) => value, inside(`a ${width}px inside stroke`), stroke);
  reader.read(
    "outline-offset",
    (value) => value,
    inside("the outline lies over the box's edge, where an inside stroke lies"),
    stroke
  );
  reader.read("outline-color", (value) => readColor(value, variables), describeColor, stroke);
  // An outline takes no layout space, so the box's layers keep their room under the stroke.
  return { color, weight: { kind: "literal", value: width }, inLayout: false };
}

/** The `box-shadow` every Tailwind shadow and ring utility writes, one layer per custom property. */
const TAILWIND_SHADOW_LAYERS = [
  "--tw-inset-shadow",
  "--tw-inset-ring-shadow",
  "--tw-ring-offset-shadow",
  "--tw-ring-shadow",
  "--tw-shadow",
] as const;

const TAILWIND_SHADOW_STACK = TAILWIND_SHADOW_LAYERS.map((layer) => `var(${layer})`).join(",");

/**
 * Read the drop shadows. Tailwind composes `box-shadow` from one custom property per layer,
 * so the builder reads each layer a class set on its own. A layer that does not map, such
 * as a shadow whose blur is a formula over a variable, leaves the other layers in place.
 */
function readShadowStack(root: LayerStyle, variables: VariableIndex): readonly ShadowSpec[] {
  const raw = root.raw("box-shadow");
  if (raw === undefined) {
    return [];
  }
  const shadows = root.feed("shadows");
  const describe = (mapped: readonly ShadowSpec[]) => ({
    outcome: mapped.some((shadow) => shadow.color.kind === "variable")
      ? ("bound" as const)
      : ("literal" as const),
    detail: mapped.length === 0 ? "no visible shadow" : `${mapped.length} drop shadow(s)`,
  });
  if (normalizeCss(raw) !== TAILWIND_SHADOW_STACK) {
    return root.read("box-shadow", (value) => readShadows(value, variables), describe, shadows) ?? [];
  }
  root.mark("box-shadow", "literal", "Tailwind's shadow stack, read layer by layer", shadows);
  return TAILWIND_SHADOW_LAYERS.flatMap((layer) =>
    root.has(layer)
      ? (root.read(layer, (value) => readShadows(value, variables), describe, shadows) ?? [])
      : []
  );
}

/**
 * A CSS border becomes a stroke, read from each side's winning width, style and color as
 * {@link sideBorders} resolves them. Where all four sides agree on all three, the border draws one
 * stroke, as {@link readStroke} reads it, so a later `border-left-width` that equals the
 * `border-width` beside it leaves a dashed border dashed. Otherwise it draws a stroke with a weight
 * on each side, as {@link readSideStroke} reads it, and anything else stays unmapped. A side whose
 * style is `none` or `hidden` has a used width of 0, whatever width it declares (CSS Backgrounds 3
 * §4.3). On a side that draws nothing, the stroke notes only the longhands that set it, so a
 * border shorthand there, as Tailwind preflight's `border: 0 solid` on every element, keeps the row
 * the ledger gives a rule no part reads. A box none of whose sides any longhand sets, and that draws
 * nothing, has no stroke.
 */
function readBorder(
  root: LayerStyle,
  variables: VariableIndex,
  collapsed: boolean,
  borders: SideBorders
): StrokeFromBorder {
  if (BORDER_SIDES.every((side) => unsetSide(borders[side]))) {
    return undefined;
  }
  return BORDER_SIDES.every((side) => sameBorder(root, variables, borders.top, borders[side]))
    ? readStroke(root, variables, collapsed, borders)
    : readSideStroke(root, variables, collapsed, borders);
}

/**
 * A border all four sides agree on becomes an inside stroke. A solid border draws a solid stroke,
 * and a dashed one a dashed stroke, as {@link dashesOf} says. A border with no style or any other
 * style stays unmapped, and so does one with no color, which would otherwise draw no stroke and
 * leave no row. A border of no width paints nothing whatever its style and color (CSS Backgrounds 3
 * §3), as a Sidebar row's `border-0` resets its `<button>`'s, so it draws no stroke, and nor does a
 * `none` or `hidden` one. A table row whose table collapses its borders takes no room for them, as
 * {@link COLLAPSED} says.
 */
function readStroke(
  root: LayerStyle,
  variables: VariableIndex,
  collapsed: boolean,
  borders: SideBorders
): EverySideStroke | undefined {
  const every = BORDER_SIDES.map((side) => borders[side]);
  const widths = declarationsOf(every.map((border) => border.width));
  const styles = declarationsOf(every.map((border) => border.style));
  const colors = [...new Set(every.map((border) => border.color))];
  const [needed] = widths;
  const { lineStyle } = borders.top;
  const zero = readBorderWidth(borders.top.width?.value ?? "", variables);
  if (zero?.kind === "literal" && zero.value === 0) {
    for (const { property } of widths.filter(({ property }) => isLonghand(property))) {
      root.read(
        property,
        (value) => value,
        () => ({ outcome: "literal", detail: "no stroke" }),
        root.feed("stroke")
      );
    }
    for (const property of [...styles.map(({ property }) => property), ...colors].filter(isLonghand)) {
      root.mark(property, "dropped", "the border has no width, so it draws nothing", []);
    }
    return undefined;
  }
  if (lineStyle === "none" || lineStyle === "hidden") {
    for (const { property } of styles.filter(({ property }) => isLonghand(property))) {
      root.read(
        property,
        (value) => value,
        () => ({ outcome: "dropped", detail: `a ${lineStyle} style draws no border` }),
        []
      );
    }
    for (const property of [...widths.map(({ property }) => property), ...colors].filter(isLonghand)) {
      root.mark(property, "dropped", `the border's ${lineStyle} style draws nothing, whatever its width`, []);
    }
    return undefined;
  }
  if (needed !== undefined && colors.includes("border-color")) {
    root.missing(
      "border-color",
      needed.property,
      "no class or base rule colors the border, so the stroke is left out"
    );
  }
  const stroke = root.feed("stroke");
  const weights = widths.map(({ property, value }) =>
    root.read(
      property,
      () => readBorderWidth(value ?? "", variables),
      (read) => {
        const note = describeNumber(read);
        return collapsed ? { ...note, detail: `${note.detail}, a stroke that ${COLLAPSED}` } : note;
      },
      stroke
    )
  );
  const [weight] = weights;
  const drawnStyles = styles.map(({ property, value }) =>
    root.read(
      property,
      () => borderStyle(normalizeCss(value ?? ""), weight),
      (read) => ({ outcome: "literal", detail: read.detail }),
      stroke
    )
  );
  const [style] = drawnStyles;
  const colored = colors.map((property) =>
    root.read(property, (value) => readColor(value, variables), describeColor, stroke)
  );
  const [color] = colored;
  if (
    style === undefined ||
    weight === undefined ||
    color === undefined ||
    ![...weights, ...drawnStyles, ...colored].every((read) => read !== undefined)
  ) {
    return undefined;
  }
  const drawn =
    style.dashPattern === undefined ? { color, weight } : { color, weight, dashPattern: style.dashPattern };
  return collapsed ? { ...drawn, inLayout: false } : drawn;
}

/**
 * Why a table row's border takes no room where its table collapses its borders. CSS sets them on the
 * grid lines between the rows (CSS 2.1 §17.6.2): Chromium keeps the row as tall as its cells and paints
 * a 1px rule on the first pixel row below it, whatever sides the border sets. Figma draws the stroke
 * inside the row, out of the layout, on its outer pixels, the nearest a stroke that stays in the row's
 * own box comes, so the row's cells keep their height.
 */
const COLLAPSED =
  "takes no room, since the table collapses its borders onto the grid lines between its rows (CSS 2.1 §17.6.2)";

/** The displays of a table row and its row groups, whose borders a table sets on its grid lines. */
const ROW_BOXES: ReadonlySet<string> = new Set([
  "table-row",
  "table-row-group",
  "table-header-group",
  "table-footer-group",
]);

/** A longhand of a box's border: a width, style or color, on every side or on one. */
const BORDER_LONGHAND =
  /^border-(?:(?:top|right|bottom|left|block|inline)(?:-start|-end)?-)?(?:width|style|color)$/;

/**
 * Whether a row's or a row group's border stays unmapped, and note it so: one that draws on some
 * side, where the capture did not measure it as the row's own in a collapsed table
 * (`bordersCollapse`). There, a box that shares one of its edges may win that edge (CSS 2.1
 * §17.6.2.1), and a row group's border always lies on lines its rows and cells share. A separated
 * table paints neither (CSS 2.1 §17.6.1). In each case no stroke on the box draws what the browser
 * paints.
 */
function unownedRowBorder(reader: LayerStyle, draws: boolean, collapsed: boolean): boolean {
  if (collapsed || !draws || !ROW_BOXES.has(normalizeCss(reader.raw("display") ?? ""))) {
    return false;
  }
  for (const property of reader.ownProperties()) {
    if (BORDER_LONGHAND.test(property)) {
      reader.mark(property, "unmapped", UNOWNED_ROW_BORDER, []);
    }
  }
  return true;
}

/** Why a row's or a row group's border stays unmapped, as {@link unownedRowBorder} says. */
const UNOWNED_ROW_BORDER =
  "a table row's or row group's border, which the capture did not measure as the row's own on its grid lines (CSS 2.1 §17.6.2.1), so the stroke is left out";

/** A box with no border, whose padding box is its border box. */
const NO_BORDER = "none";

/**
 * Read `background-clip: padding-box`, which paints the background inside the border only (CSS
 * Backgrounds 3 §3.7), where Figma paints a fill under the whole frame and its stroke inside it
 * (`strokeAlign` INSIDE), over the fill. The two draw alike in two cases, and the clip drops there:
 *
 * - The box has no border, so its padding box is its border box.
 * - The border draws as a solid stroke in a color that is opaque in every mode, a literal or a
 *   synced variable, so the stroke hides the fill beneath it.
 *
 * Beside a translucent or dashed stroke that takes its room in the layout, with literal widths, a
 * box that fills with a color draws its fill on a layer of its own inside the border instead, which
 * `padding-box-fill.ts` builds and reads the clip for. Each side's inset is that side's used width,
 * as {@link sideBorders} reads it for the stroke, so `border-2 border-l-4` insets the fill 4px on
 * the left. A side whose own style is `none` or `hidden` draws no border, so its inset is 0 and the
 * other sides keep theirs.
 * A fractional width, which Chromium snaps to whole device pixels, leaves the clip unmapped, and so
 * does any other border or value.
 *
 * @param reader - The box's style.
 * @param border - The stroke the box's border draws, undefined where it does not map, or
 *   {@link NO_BORDER} for a box with no border.
 * @param borders - Each side's border, which gives the side's inset.
 * @param fill - The box's fill, undefined for none.
 * @param variables - The synced variables, which say whether a color is opaque in every mode.
 * @returns The border's width on each side, where the fill draws inside it, or undefined.
 */
function readBackgroundClip(
  reader: LayerStyle,
  border: StrokeFromBorder | typeof NO_BORDER,
  borders: SideBorders,
  fill: BoxPaint["fill"],
  variables: VariableIndex
): PaddingBoxInsets | undefined {
  const detail =
    border === NO_BORDER
      ? "the box has no border, so its padding box is its border box"
      : border !== undefined && !("dashPattern" in border) && opaqueIn(border.color, variables)
        ? "the box's border draws as a solid stroke, opaque in every mode, over the fill beneath it"
        : undefined;
  const clipped = normalizeCss(reader.resolved("background-clip") ?? "") === "padding-box";
  const insets =
    detail === undefined && clipped && border !== NO_BORDER && fill?.kind !== "image" && fill !== undefined
      ? paddingInsets(border, borders)
      : undefined;
  if (insets !== undefined && Object.values(insets).some((width) => !Number.isInteger(width))) {
    reader.mark("background-clip", "unmapped", FRACTIONAL, []);
    return undefined;
  }
  if (insets !== undefined) {
    return insets;
  }
  reader.read(
    "background-clip",
    (value) => (detail !== undefined && normalizeCss(value) === "padding-box" ? value : undefined),
    () => ({ outcome: "dropped", detail: detail ?? "" }),
    []
  );
  return undefined;
}

/**
 * Why a clip stays unmapped beside a fractional border width. At device scale 1 Chromium draws a
 * 0.5px and a 1.5px border 1px wide, and the capture holds the width as authored, not as drawn.
 */
const FRACTIONAL =
  "Chromium snaps a fractional border width to whole device pixels, and the capture holds the authored width, so the kit cannot tell where the padding box starts";

/** The width in pixels of a box's border on each side, as its stroke draws it. */
export type PaddingBoxInsets = Readonly<Record<StrokeSide, number>>;

/**
 * Each side's used width, where the stroke takes its room in the layout, as a CSS border does, and
 * every side's width is a literal. Undefined for no stroke, a bound width, or a stroke drawn out of
 * the layout.
 */
function paddingInsets(stroke: StrokeFromBorder, borders: SideBorders): PaddingBoxInsets | undefined {
  if (stroke === undefined || stroke.inLayout === false) {
    return undefined;
  }
  const [top, right, bottom, left] = BORDER_SIDES.map((side) => borders[side].used);
  return top === undefined || right === undefined || bottom === undefined || left === undefined
    ? undefined
    : { top, right, bottom, left };
}

/** The stroke a box's border draws, on every side or some, or undefined where it does not map. */
type StrokeFromBorder = EverySideStroke | SideStroke | undefined;

/** Whether a color is fully opaque in every mode: a literal at alpha 1, or a variable that is. */
function opaqueIn(color: ColorSpec, variables: VariableIndex): boolean {
  return color.kind === "literal" ? color.color.a === 1 : variables.opaque(color.variable);
}

/** The sides a CSS border can set alone, as `border-l` sets `border-left-width`. */
const BORDER_SIDES = ["top", "right", "bottom", "left"] as const;

type BorderSide = (typeof BORDER_SIDES)[number];

/**
 * The logical name of each side, which Tailwind's `border-s` and `border-e` compile to. The kit draws
 * a left-to-right page in horizontal writing, where the inline start is the left and the block start
 * the top (CSS Logical Properties 1 §4), so each logical side reads as its physical side.
 */
const LOGICAL_SIDE = {
  top: "block-start",
  right: "inline-end",
  bottom: "block-end",
  left: "inline-start",
} as const satisfies Record<BorderSide, string>;

/** A part of a side's border whose declaration the stroke reads a side's value from. */
type SidePart = "width" | "style";

/**
 * The declaration that wins one part of a side's border, and the side's value from it: the
 * declaration's own value for the side's longhand, by its physical or logical name, or for a
 * `border-width` or `border-style` the shorthand split leaves whole, and otherwise the side's share
 * of a border shorthand, as `border: 0 solid` gives each side a 0 width and a solid style.
 */
type SideDeclaration = {
  readonly property: string;
  /** The side's value, or undefined where the build cannot split the shorthand, as `border-inline-width`. */
  readonly value: string | undefined;
};

/** A side's border: the declarations that win its width and style, the property that colors it, and the width it draws at. */
type SideBorder = {
  readonly width: SideDeclaration | undefined;
  readonly style: SideDeclaration | undefined;
  /** The property that colors the side, as {@link sideColorProperty} says. */
  readonly color: string;
  /** The side's style, normalized, or the empty string where none is known. */
  readonly lineStyle: string;
  /**
   * The side's used width: 0 where its style is `none` or `hidden` or no declaration gives it a
   * width, its literal width otherwise, and undefined for a width that is no literal.
   */
  readonly used: number | undefined;
};

/** Each physical side's border. */
type SideBorders = Readonly<Record<BorderSide, SideBorder>>;

/**
 * The declaration that wins a part of a side's border: the one the capture records as winning the
 * side's physical longhand, as {@link sideColorProperty} reads a side's color, or the side's own or
 * the box's whole longhand where the capture records none. A `border-width` that wins only some
 * sides sets each of them as a longhand of its own, as `border-shorthands.ts` splits it.
 */
function sideDeclaration(root: LayerStyle, side: BorderSide, part: SidePart): SideDeclaration | undefined {
  const longhand = `border-${side}-${part}`;
  const whole = [longhand, `border-${LOGICAL_SIDE[side]}-${part}`, `border-${part}`];
  const property = root.winnerOf(longhand) ?? whole.find((each) => root.has(each));
  if (property === undefined) {
    return undefined;
  }
  const value = root.resolved(property) ?? "";
  const split = borderLonghands(property, value);
  return {
    property,
    value:
      split === undefined
        ? whole.includes(property)
          ? value
          : undefined
        : split.find(([name]) => name === longhand)?.[1],
  };
}

/** A box's used border width on each physical side, in pixels, or undefined for one that is no literal. */
export type BorderWidths = Readonly<Record<"top" | "right" | "bottom" | "left", number | undefined>>;

/**
 * A box's used border width on each side, as its stroke draws it: 0 on a side whose style is `none`
 * or `hidden` or that no declaration gives a width, and a width a shorthand such as `border: 2px
 * solid` sets included. A reader that adds the border to the box's size, as `held-size.ts` does,
 * reads it here, so the size and the stroke agree.
 *
 * @param reader - The box's style.
 * @param variables - The synced variables a width can bind.
 * @returns Each side's width.
 */
export function borderWidths(reader: LayerStyle, variables: VariableIndex): BorderWidths {
  const borders = sideBorders(reader, variables);
  return {
    top: borders.top.used,
    right: borders.right.used,
    bottom: borders.bottom.used,
    left: borders.left.used,
  };
}

/**
 * The property of the declaration that wins a side's border width, as `border-bottom-width` or a
 * `border-bottom` shorthand, for a coverage row about that side's width.
 *
 * @param reader - The box's style.
 * @param side - The side.
 * @returns The property, or undefined where no declaration gives the side a width.
 */
export function borderWidthProperty(reader: LayerStyle, side: BorderSide): string | undefined {
  return sideDeclaration(reader, side, "width")?.property;
}

/** Read each side's border once, from the declarations that win its width, style and color. */
function sideBorders(root: LayerStyle, variables: VariableIndex): SideBorders {
  const of = (side: BorderSide): SideBorder => {
    const width = sideDeclaration(root, side, "width");
    const style = sideDeclaration(root, side, "style");
    const lineStyle = normalizeCss(style?.value ?? "").toLowerCase();
    const read = readBorderWidth(width?.value ?? "", variables);
    return {
      width,
      style,
      color: sideColorProperty(root, side),
      lineStyle,
      used:
        width === undefined || lineStyle === "none" || lineStyle === "hidden"
          ? 0
          : read?.kind === "literal" && read.value >= 0
            ? read.value
            : undefined,
    };
  };
  return { top: of("top"), right: of("right"), bottom: of("bottom"), left: of("left") };
}

/**
 * Whether a side draws nothing and no longhand gives it a width: a border shorthand's zero, as
 * preflight's `border: 0 solid`, or no width at all. The stroke notes nothing for it.
 */
function unsetSide(border: SideBorder): boolean {
  return border.used === 0 && (border.width === undefined || !isLonghand(border.width.property));
}

/** Whether a property is a longhand of a box's border, as {@link BORDER_LONGHAND} says. */
function isLonghand(property: string): boolean {
  return BORDER_LONGHAND.test(property);
}

/**
 * Whether two sides take the same width, style and color: from one declaration, or values that
 * compute alike, as `calc(1px + 1px)` and `2px` are one width and `rgb(255 0 0)` and `#ff0000` one
 * color. Two widths or colors that bind different variables differ.
 */
function sameBorder(root: LayerStyle, variables: VariableIndex, one: SideBorder, other: SideBorder): boolean {
  const same = (
    left: SideDeclaration | undefined,
    right: SideDeclaration | undefined,
    alike: (left: string, right: string) => boolean
  ): boolean =>
    left?.value === undefined || right?.value === undefined
      ? left?.property === right?.property && left?.value === right?.value
      : normalizeCss(left.value) === normalizeCss(right.value) || alike(left.value, right.value);
  const color = (border: SideBorder) => root.resolved(border.color) ?? "";
  return (
    same(one.width, other.width, (left, right) =>
      sameNumber(readBorderWidth(left, variables), readBorderWidth(right, variables))
    ) &&
    same(one.style, other.style, () => one.lineStyle === other.lineStyle) &&
    (one.color === other.color ||
      normalizeCss(color(one)) === normalizeCss(color(other)) ||
      sameColor(readColor(color(one), variables), readColor(color(other), variables)))
  );
}

/** Whether two numbers are one literal, or bind one variable. */
function sameNumber(left: NumberSpec | undefined, right: NumberSpec | undefined): boolean {
  return left?.kind === "literal"
    ? right?.kind === "literal" && left.value === right.value
    : left !== undefined && right?.kind === "variable" && sameVariable(left.variable, right.variable);
}

/** Whether two colors are one literal, channel by channel, or bind one variable. */
function sameColor(left: ColorSpec | undefined, right: ColorSpec | undefined): boolean {
  if (left?.kind === "literal") {
    return (
      right?.kind === "literal" &&
      (["r", "g", "b", "a"] as const).every((channel) => left.color[channel] === right.color[channel])
    );
  }
  return left !== undefined && right?.kind === "variable" && sameVariable(left.variable, right.variable);
}

/** Whether two variable references name one variable. */
function sameVariable(left: VariableRef, right: VariableRef): boolean {
  return left.collection === right.collection && left.name === right.name;
}

/**
 * A side's border width as a number: a synced variable it binds, or its literal pixels where the
 * value is a border width at all, as {@link borderWidthLength} checks, so a `var()` that substitutes
 * `12` with no unit reads as no width rather than 12px.
 */
function readBorderWidth(value: string, variables: VariableIndex): NumberSpec | undefined {
  const read = readNumber(value, variables);
  return read?.kind === "literal" && borderWidthLength(value) === undefined ? undefined : read;
}

/** The distinct declarations among the sides', by property, in side order. */
function declarationsOf(declarations: readonly (SideDeclaration | undefined)[]): readonly SideDeclaration[] {
  return [
    ...new Map(
      declarations.flatMap((declaration) =>
        declaration === undefined ? [] : [[declaration.property, declaration] as const]
      )
    ).values(),
  ];
}

/** Sides as a coverage detail names them, as "left" or "top, right and bottom". */
function namedSides(sides: readonly BorderSide[]): string {
  const last = sides.at(-1) ?? "";
  return sides.length < 2 ? last : `${sides.slice(0, -1).join(", ")} and ${last}`;
}

/** What the widths of some sides draw, for the coverage table. */
function describeSideWidths(
  sides: readonly BorderSide[],
  weights: readonly number[],
  collapsed: boolean
): string {
  const byWeight = Map.groupBy(sides, (_, index) => weights[index] ?? 0);
  return [...byWeight]
    .map(([weight, owned]) => {
      const named = namedSides(owned);
      return weight === 0
        ? `no stroke on the ${named} ${owned.length === 1 ? "side" : "sides"}`
        : collapsed
          ? `a ${weight}px ${named} stroke that ${COLLAPSED}`
          : `a ${weight}px ${named} stroke that takes its room on ${owned.length === 1 ? "that side" : "those sides"} (PS)`;
    })
    .join("; ");
}

/** Why a border shorthand whose part for a side the build cannot split leaves the stroke out. */
const UNREAD_SIDE_SHORTHAND =
  "a border shorthand sets a side's width or style, and the build cannot split it";

/**
 * A border whose sides differ becomes a solid stroke with a weight on each side, as `border-r` draws
 * the Sidebar container's edge and `border-s` a Number field stepper's start edge, and each side's
 * weight takes room on that side (PS). Each side draws at its used width, as {@link sideBorders}
 * reads it, so a later `border-left-width: 0` beside a `border-width` draws the other three sides. A
 * side at a used width of 0 draws nothing whatever its style, and a box none of whose sides draws
 * has no stroke. On a side of any other width, a width that is no literal, a style other than solid,
 * no color, or a shorthand the build cannot split leaves the stroke out, with the sides that do not
 * map unmapped.
 *
 * A table row whose table collapses its borders takes no room for them, as {@link COLLAPSED} says.
 */
function readSideStroke(
  root: LayerStyle,
  variables: VariableIndex,
  collapsed: boolean,
  borders: SideBorders
): SideStroke | undefined {
  const stroke = root.feed("stroke");
  const sides: SideWidths = {
    top: borders.top.used,
    right: borders.right.used,
    bottom: borders.bottom.used,
    left: borders.left.used,
  };
  const noted = BORDER_SIDES.filter((side) => !unsetSide(borders[side]));
  const styledNone = (side: BorderSide): boolean =>
    borders[side].lineStyle === "none" || borders[side].lineStyle === "hidden";
  for (const [property, owned] of Map.groupBy(noted, (side) => borders[side].width?.property)) {
    if (property === undefined) {
      continue;
    }
    if (owned.some((side) => borders[side].width?.value === undefined)) {
      root.mark(property, "unmapped", UNREAD_SIDE_SHORTHAND, stroke);
      continue;
    }
    const drawing = owned.filter((side) => !styledNone(side));
    if (drawing.length === 0) {
      root.mark(property, "dropped", "its side's style draws no border, whatever its width", []);
      continue;
    }
    const weights = drawing.map((side) => sides[side]);
    root.read(
      property,
      () => (weights.every((weight) => weight !== undefined) ? weights : undefined),
      (read) => ({ outcome: "literal", detail: describeSideWidths(drawing, read, collapsed) }),
      stroke
    );
  }
  for (const [property, owned] of Map.groupBy(noted, (side) => borders[side].style?.property)) {
    const drawing = owned.filter((side) => sides[side] !== 0);
    if (property === undefined || drawing.some((side) => borders[side].style?.value === undefined)) {
      if (property !== undefined) {
        root.mark(property, "unmapped", UNREAD_SIDE_SHORTHAND, stroke);
      }
      for (const side of drawing) {
        sides[side] = undefined;
      }
      continue;
    }
    if (drawing.length > 0) {
      const solid = drawing.every((side) => borders[side].lineStyle === "solid");
      root.read(
        property,
        (value) => (solid ? value : undefined),
        () => ({ outcome: "literal", detail: "a solid stroke" }),
        stroke
      );
      for (const side of solid ? [] : drawing) {
        sides[side] = undefined;
      }
      continue;
    }
    const none = owned.find(styledNone);
    if (!isLonghand(property)) {
      continue;
    }
    if (none !== undefined) {
      // A `none` or `hidden` style computes the width to 0 (CSS Backgrounds 3 §4.3), so its side
      // draws nothing, as a Description list item's `border-none` leaves its `border-b`.
      root.read(
        property,
        (value) => value,
        () => ({
          outcome: "dropped",
          detail: `a ${borders[none].lineStyle} style draws no border on its side`,
        }),
        []
      );
    } else {
      root.mark(property, "dropped", "its side has no width, so it draws nothing", []);
    }
  }
  const color = readSideColor(root, variables, borders, sides, stroke);
  const { top, right, bottom, left } = sides;
  if (
    color === undefined ||
    top === undefined ||
    right === undefined ||
    bottom === undefined ||
    left === undefined
  ) {
    return undefined;
  }
  const weights = { top, right, bottom, left };
  return collapsed ? { color, sides: weights, inLayout: false } : { color, sides: weights };
}

/**
 * Each side's width as a stroke on some sides reads it: 0 for a side the box gives no width of its
 * own or one it proves draws nothing, and undefined for one whose width or style does not map, which
 * may draw.
 */
type SideWidths = Record<BorderSide, number | undefined>;

/** The axis whose shorthand colors each side, as `border-x-*` sets `border-inline-color`. */
const SIDE_AXIS = {
  top: "block",
  right: "inline",
  bottom: "block",
  left: "inline",
} as const satisfies Record<BorderSide, string>;

/** Every property that can set a side's color: `border-color`, its axis's, and its own by either name. */
const sideColorProperties = (side: BorderSide): readonly string[] => [
  "border-color",
  `border-${SIDE_AXIS[side]}-color`,
  `border-${side}-color`,
  `border-${LOGICAL_SIDE[side]}-color`,
];

/**
 * The property that colors a side: the declaration the capture records as winning the side's
 * physical color longhand, as `border-x-[#ff0000]` after `border-transparent` wins the left side's.
 * `border-color` stays the winner of the top and bottom a later `border-inline-color` leaves it.
 * Where no declaration of the box wins it, `border-color` stands for the base rule that would.
 */
function sideColorProperty(root: LayerStyle, side: BorderSide): string {
  return root.winnerOf(`border-${side}-color`) ?? "border-color";
}

/**
 * Read the color of a stroke on some sides from the sides that draw. Figma strokes every side in one
 * color, so the sides that draw must share one, and a color that reaches only sides of no width draws
 * nothing, as a segment's `border-transparent` beside its `border-s-border` does. A side whose width
 * or style does not map may draw, so its color stays unmapped rather than dropped. A shorthand that
 * wins a drawing side's color, as `border-left` or `border`, stays unmapped, and so does the stroke,
 * since the build reads a color only from a color property.
 */
function readSideColor(
  root: LayerStyle,
  variables: VariableIndex,
  borders: SideBorders,
  sides: Readonly<SideWidths>,
  stroke: Feed
): ColorSpec | undefined {
  const drawing = BORDER_SIDES.filter((side) => (sides[side] ?? 0) > 0);
  const drawn = new Set(drawing.map((side) => borders[side].color));
  const unknown = new Set(
    BORDER_SIDES.filter((side) => sides[side] === undefined).map((side) => borders[side].color)
  );
  for (const property of unknown) {
    if (!drawn.has(property)) {
      root.mark(
        property,
        "unmapped",
        "its side's width or style does not map, so the stroke is left out",
        stroke
      );
    }
  }
  const [first = "left"] = drawing;
  if (drawn.has("border-color")) {
    root.missing(
      "border-color",
      borders[first].width?.property ?? "border-width",
      "no class or base rule colors the border, so the stroke is left out"
    );
  }
  const bare = BORDER_SIDES.flatMap((side) =>
    sideColorProperties(side).filter(
      (property) => root.has(property) && !drawn.has(property) && !unknown.has(property)
    )
  );
  for (const property of new Set(bare)) {
    root.mark(property, "dropped", "it colors only sides the border gives no width, which draw nothing", []);
  }
  // With no side that draws, the box has no stroke, whatever colors it.
  if (drawn.size === 0) {
    return undefined;
  }
  const shorthands = drawing
    .map((side) => [side, borders[side].color] as const)
    .filter(([side, property]) => !sideColorProperties(side).includes(property));
  if (shorthands.length > 0) {
    // A read, not a mark, since the stroke may read the same shorthand's width or style, and a
    // read takes the row over a mark.
    for (const property of new Set(shorthands.map(([, property]) => property))) {
      root.read(
        property,
        (value) => value,
        () => ({
          outcome: "unmapped",
          detail: "a border shorthand colors a side that draws, and the build does not read it",
        }),
        stroke
      );
    }
    return undefined;
  }
  const shared = new Set(
    [...drawn].map((property) => JSON.stringify(readColor(root.resolved(property) ?? "", variables) ?? null))
  );
  if (shared.size > 1) {
    for (const property of drawn) {
      root.mark(
        property,
        "unmapped",
        "Figma strokes every side in one color, and the sides that draw take two",
        stroke
      );
    }
    return undefined;
  }
  const colors = [...drawn].map((property) =>
    root.read(property, (value) => readColor(value, variables), describeColor, stroke)
  );
  return colors.every((color) => color !== undefined) ? colors[0] : undefined;
}

/** A border style the stroke draws: the dash pattern of a dashed one, and its coverage detail. */
type BorderStyle = {
  readonly dashPattern: readonly number[] | undefined;
  readonly detail: string;
};

/**
 * Read a border style as the stroke's. A dashed border's dashes follow its width, so it maps only
 * at a literal width, since a bound width takes another length in each mode.
 *
 * @param style - The computed `border-style`.
 * @param weight - The border's width, as the stroke reads it.
 * @returns The style, or undefined for one no stroke draws.
 */
function borderStyle(style: string, weight: NumberSpec | undefined): BorderStyle | undefined {
  if (style === "solid") {
    return { dashPattern: undefined, detail: "a solid stroke" };
  }
  if (style !== "dashed" || weight?.kind !== "literal") {
    return undefined;
  }
  const [dash, gap] = dashesOf(weight.value);
  return {
    dashPattern: [dash, gap],
    detail: `a dashed stroke, ${dash}px dashes and ${gap}px gaps, as Chromium draws a ${weight.value}px dashed border`,
  };
}

/**
 * The dash and gap Chromium draws along a dashed border of a width, which CSS leaves to the browser
 * (CSS Backgrounds 3 §4.2). On 2026-10-23 the compare run's Chromium drew 3px dashes and 2px gaps
 * along a 1px border, 6px and 4px along a 2px one, and 6px and 3px along a 3px one: 3 and 2 times
 * the width below 3px, and 2 times and once the width from 3px. Chromium also stretches a side's gaps
 * by up to half a pixel so the side ends on a dash, where a Figma dash pattern repeats its lengths
 * around the whole stroke, so the dashes along a side can drift a few pixels from the browser's.
 *
 * @param width - The border's width in pixels.
 * @returns The dash and the gap in pixels.
 */
function dashesOf(width: number): readonly [number, number] {
  return width < 3 ? [3 * width, 2 * width] : [2 * width, width];
}
