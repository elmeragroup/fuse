/**
 * How a box paints, read from its style: its fill, or the picture it shows, its stroke, its drop
 * shadows, and an outline that paints nothing. `box-mapping.ts` maps a box's layout and layers,
 * and asks this module for the box's paint and for the coverage note of a color it reads itself,
 * such as a text color.
 */
import { createHash } from "node:crypto";

import { borderLonghands, borderWidthLength } from "../capture/border-shorthands.ts";
import { flowRelativeEdges } from "../capture/winners.ts";
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
import { makeBareSides } from "./kit-spec";
import type {
  BareSides,
  BareStroke,
  BoundNumber,
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
import type { LogicalSides } from "./logical-sides";

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
 * @param logical - Where the box's logical sides, their widths and their styles lie, as
 *   `logical-sides.ts` reads them.
 * @returns The box's fill, stroke and shadows, the used width of its border on each side, and the
 *   border's widths where the fill draws inside the border on a layer of its own, as
 *   {@link readBackgroundClip} says. A box whose widths lie elsewhere, as {@link widthsPlaced} reads
 *   them, has no width known on any side.
 * @throws When a box that shows a picture sets no `object-fit`, as {@link readImage} says.
 */
export function readPaint(
  reader: LayerStyle,
  image: (() => Uint8Array) | undefined,
  variables: VariableIndex,
  variant: string,
  collapsed: boolean,
  logical: BorderFlow
): { readonly paint: BoxPaint; readonly widths: BorderWidths; readonly paddingBox?: PaddingBoxInsets } {
  const borders = sideBorders(reader, variables);
  const placed = widthsPlaced(logical);
  const widths = placed.kind === "elsewhere" ? UNKNOWN_WIDTHS : usedWidths(borders);
  // A side that may draw: one of a width other than 0, or of a width that does not map or is unknown.
  const draws = BORDER_SIDES.some((side) => widths[side] !== 0);
  const border = unownedRowBorder(reader, draws, collapsed)
    ? undefined
    : readBorder(reader, variables, collapsed, borders, logical.sides);
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
  const background = shown ?? (paintsNoBackground(reader, image, fill) ? NO_BACKGROUND : undefined);
  const paddingBox = readBackgroundClip(
    reader,
    draws ? border : NO_BORDER,
    widths,
    placed,
    background,
    variables
  );
  const paint = { fill: shown, stroke, shadows };
  const backgroundBlur = readBackgroundBlur(reader);
  const blurred = backgroundBlur === undefined ? paint : { ...paint, backgroundBlur };
  return paddingBox === undefined ? { paint: blurred, widths } : { paint: blurred, widths, paddingBox };
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
 * `border-width` beside it leaves a dashed border dashed. A border of one bound weight that leaves
 * some sides bare draws that one stroke with those sides named, as {@link bareSides} reads them.
 * Otherwise it draws a stroke with a weight on each side, as {@link readSideStroke} reads it, and
 * anything else stays unmapped. A box whose logical sides lie elsewhere draws none, as
 * {@link leaveSides} says. A side whose style is `none` or `hidden` has a used width of 0, whatever width it declares (CSS Backgrounds 3
 * §4.3). On a side that draws nothing, the stroke notes only the longhands that set it, so a
 * border shorthand there, as Tailwind preflight's `border: 0 solid` on every element, keeps the row
 * the ledger gives a rule no part reads. A box none of whose sides any longhand sets, and that draws
 * nothing, has no stroke.
 */
function readBorder(
  root: LayerStyle,
  variables: VariableIndex,
  collapsed: boolean,
  borders: SideBorders,
  logical: LogicalSides
): StrokeFromBorder {
  if (logical.kind === "elsewhere") {
    leaveSides(root, logical.reason);
    return undefined;
  }
  if (BORDER_SIDES.every((side) => unsetSide(borders[side]))) {
    return undefined;
  }
  if (BORDER_SIDES.every((side) => sameBorder(root, variables, borders.top, borders[side]))) {
    return readStroke(root, variables, collapsed, borders);
  }
  const bare = bareSides(root, variables, borders);
  return bare === undefined
    ? readSideStroke(root, variables, collapsed, borders)
    : readBareStroke(root, variables, collapsed, borders, bare);
}

/**
 * Where a box's logical border sides lie, as `logicalSidesOf` reads them: the sides, which a color, a
 * width or a style sets, their widths, which a width or a border shorthand sets, and their styles. A
 * box whose logical sides lie elsewhere draws no stroke, and {@link widthsPlaced} reads whether it
 * knows its widths.
 */
type BorderFlow = {
  readonly sides: LogicalSides;
  readonly widths: LogicalSides;
  readonly styles: LogicalSides;
  /** The capture measured every side's used width 0 in every mode (`zeroWidths`). */
  readonly zeroWidths: boolean;
};

/**
 * Where a box's border widths lie: elsewhere, so no side's width is known, where a logical width lies
 * elsewhere, or a logical style does and the capture did not measure every side's used width 0 in
 * every mode. The capture checks the widths it resolves against the browser's in the page's own mode
 * alone, so in another mode a logical width may sit on another side, and a logical style may zero or
 * draw another side than the capture reads, as `border-inline-start-style: none` zeroes the top
 * under `vertical-rl`, and a dark rule's `border-width: 3px` with `border-inline-start-style: solid`
 * draws the right side right to left where light draws none. A style moves no width where every
 * side's used width is 0 in every mode, as preflight's `border: 0 solid` leaves it, which the
 * capture measures only where it reads the box's flow, so a pseudo-element's widths stay unknown. A
 * logical color moves no width.
 */
function widthsPlaced(logical: BorderFlow): LogicalSides {
  if (logical.widths.kind === "elsewhere") {
    return logical.widths;
  }
  return logical.styles.kind === "elsewhere" && !logical.zeroWidths
    ? logical.styles
    : { kind: "left-to-right" };
}

/**
 * Leave every border declaration of the box's own unmapped, and so its stroke, where its logical
 * sides lie elsewhere. The capture records the side a flow-relative declaration wins as on the kit's
 * left-to-right, horizontal page, where right to left `border-inline-start-width` sets the right side
 * (CSS Logical Properties 1 §4), so it may name the wrong declaration for any side. It splits a
 * `border-width` that loses a side into the sides it wins, which then go with the others. A box none
 * of whose own declarations names a side by its flow-relative name, as where only a rule of another
 * mode sets one (`otherFlow`), notes each declaration with why.
 */
function leaveSides(root: LayerStyle, reason: string): void {
  const own = root.ownProperties().filter((property) => BORDER_DECLARATION.test(property));
  const logical = own.filter((property) => flowRelativeEdges(property).includes("sides"));
  for (const property of own) {
    root.mark(
      property,
      "unmapped",
      logical.length === 0 || logical.includes(property)
        ? reason
        : "a flow-relative side of the box does not map, so none of its sides does",
      root.feed("stroke")
    );
  }
}

/** A declaration of a box's border sides: a longhand or a shorthand, on every side or on some. */
const BORDER_DECLARATION =
  /^border(?:-(?:top|right|bottom|left|block|inline)(?:-start|-end)?)?(?:-(?:width|style|color))?$/;

/** A side a border leaves bare, with the declaration of the box's own that leaves it so. */
type BareSide = {
  readonly side: BorderSide;
  /** Its width of a literal 0, or its style of `none` or `hidden`, which computes the width to 0. */
  readonly by: "width" | "style";
};

/** A border of one bound weight that leaves some sides bare, as {@link bareSides} reads it. */
type BareBorder = {
  readonly weight: BoundNumber;
  readonly bare: readonly [BareSide, ...BareSide[]];
  /** The bare sides as the stroke names them. */
  readonly sides: BareSides;
  /** The sides that draw, in {@link BORDER_SIDES}' order. */
  readonly drawing: readonly BorderSide[];
  /** The properties of the declarations that win a width, a style or a color of a side that draws. */
  readonly drawn: ReadonlySet<string>;
};

/**
 * The bound weight of a border that leaves some sides bare, and those sides in {@link BORDER_SIDES}'
 * order, as a group member's `border-l-0` collapses the left side of an outline Button's
 * `button-outline-width`. Figma weighs each side on its own, so a stroke of the one weight that names
 * its bare sides draws them, where a stroke on some sides holds literal weights alone. Each bare side
 * draws nothing by a declaration of the box's own that wins no side that draws: a width of a literal
 * 0, or a style of `none` or `hidden`, which computes the width to 0 (CSS Backgrounds 3 §4.3), and
 * not a border shorthand's zero from another rule, as preflight's `border: 0 solid`, which
 * {@link unsetSide} leaves unnoted. Each bare side keeps the declaration that leaves it bare, a
 * `none` or `hidden` style ahead of a width. The sides that draw agree on their width and style, the
 * style solid, and {@link resolveSideColor} decides their color. Undefined for any other border, a
 * literal weight among them, which {@link readSideStroke} reads.
 */
function bareSides(root: LayerStyle, variables: VariableIndex, borders: SideBorders): BareBorder | undefined {
  const drawing = BORDER_SIDES.filter((side) => borders[side].used !== 0);
  const unweighted = BORDER_SIDES.filter((side) => borders[side].used === 0);
  if (unweighted.some((side) => unsetSide(borders[side]))) {
    return undefined;
  }
  const [first] = drawing;
  if (first === undefined || unweighted.length === 0) {
    return undefined;
  }
  const lead = borders[first];
  const weight = readBorderWidth(lead.width?.value ?? "", variables);
  if (
    weight?.kind !== "variable" ||
    lead.lineStyle !== "solid" ||
    !drawing.every((side) => sameWidthAndStyle(variables, lead, borders[side]))
  ) {
    return undefined;
  }
  const drawn = drawingDeclarations(borders, drawing);
  const owned = (side: BorderSide, part: SidePart): boolean => {
    const declaration = borders[side][part];
    return (
      declaration !== undefined &&
      root.winnerOf(`border-${side}-${part}`) === declaration.property &&
      !drawn.has(declaration.property)
    );
  };
  const zeroed = (side: BorderSide): boolean => {
    const width = readBorderWidth(borders[side].width?.value ?? "", variables);
    return width?.kind === "literal" && width.value === 0;
  };
  const hidden = (side: BorderSide): boolean => ["none", "hidden"].includes(borders[side].lineStyle);
  const bare = unweighted.flatMap((side): readonly BareSide[] =>
    hidden(side) && owned(side, "style")
      ? [{ side, by: "style" }]
      : zeroed(side) && owned(side, "width")
        ? [{ side, by: "width" }]
        : []
  );
  const [head, ...rest] = bare;
  const sides = makeBareSides(bare.map(({ side }) => side));
  return head === undefined || sides === undefined || bare.length !== unweighted.length
    ? undefined
    : { weight, bare: [head, ...rest], sides, drawing, drawn };
}

/** The properties of the declarations that win a width, a style or a color of the sides that draw. */
function drawingDeclarations(borders: SideBorders, drawing: readonly BorderSide[]): ReadonlySet<string> {
  return new Set(
    drawing.flatMap((side) =>
      [borders[side].width?.property, borders[side].style?.property, borders[side].color].filter(
        (property) => property !== undefined
      )
    )
  );
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
      (read) => describeWeight(read, collapsed),
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

/** A stroke weight as the coverage table notes it, on a table row whose table collapses its borders too. */
function describeWeight(read: NumberSpec, collapsed: boolean): CoverageNote {
  const note = describeNumber(read);
  return collapsed ? { ...note, detail: `${note.detail}, a stroke that ${COLLAPSED}` } : note;
}

/**
 * A border of one bound weight that leaves some sides bare, as {@link bareSides} reads it, becomes a
 * solid stroke of that weight that names the bare sides. The sides that draw take one color, as
 * {@link resolveSideColor} reads it, which the stroke resolves before it notes any width or style as
 * drawn. A color that does not map leaves the stroke out, with the widths and styles unmapped and
 * each bare side's declaration noting why its side was bare, as {@link noteBareSides} says.
 */
function readBareStroke(
  root: LayerStyle,
  variables: VariableIndex,
  collapsed: boolean,
  borders: SideBorders,
  border: BareBorder
): BareStroke | undefined {
  const stroke = root.feed("stroke");
  const { weight, sides, drawing } = border;
  const { color, notes } = resolveSideColor(root, variables, borders, drawing, []);
  const widths = declarationsOf(drawing.map((side) => borders[side].width));
  const styles = declarationsOf(drawing.map((side) => borders[side].style));
  if (color === undefined) {
    for (const { property } of [...widths, ...styles]) {
      root.mark(property, "unmapped", STROKE_LEFT_OUT, stroke);
    }
    noteSideColor(root, variables, notes, stroke);
    noteBareSides(root, borders, border, "left out", stroke);
    return undefined;
  }
  for (const { property } of widths) {
    root.read(
      property,
      () => weight,
      (read) => describeWeight(read, collapsed),
      stroke
    );
  }
  for (const { property } of styles) {
    root.read(
      property,
      (value) => value,
      () => ({ outcome: "literal", detail: "a solid stroke" }),
      stroke
    );
  }
  noteSideColor(root, variables, notes, stroke);
  noteBareSides(root, borders, border, "drawn", stroke);
  const drawn = { color, weight, bare: sides };
  return collapsed ? { ...drawn, inLayout: false } : drawn;
}

/**
 * Note the declarations that set only bare sides of a stroke of one bound weight, as
 * {@link bareSides} reads them. The declaration that leaves a side bare, its width of 0 or its
 * `none` or `hidden` style, reads as no stroke there where the stroke draws, and stays unmapped with
 * that reason where the stroke is left out. Any other width, style or color of a bare side alone
 * drops, since it draws nothing.
 */
function noteBareSides(
  root: LayerStyle,
  borders: SideBorders,
  { bare, drawn }: BareBorder,
  stroke: "drawn" | "left out",
  feed: Feed
): void {
  const parts = bare.flatMap(({ side, by }) => [
    { side, by: "width", property: borders[side].width?.property, bares: by === "width" },
    { side, by: "style", property: borders[side].style?.property, bares: by === "style" },
    { side, by: "color", property: borders[side].color, bares: false },
  ]);
  for (const [property, owned] of Map.groupBy(parts, (each) => each.property)) {
    if (property === undefined || drawn.has(property) || !root.has(property)) {
      continue;
    }
    const [first, ...others] = owned.filter((each) => each.bares);
    if (first === undefined) {
      root.mark(property, "dropped", "it sets only sides the border leaves bare, which draw nothing", []);
      continue;
    }
    const sides = [first, ...others].map(({ side }) => side);
    const named = `${namedSides(sides)} ${sides.length === 1 ? "side" : "sides"}`;
    const { lineStyle } = borders[first.side];
    if (stroke === "left out") {
      const by = first.by === "style" ? `its ${lineStyle} style` : "its width of 0";
      root.mark(property, "unmapped", `${by} leaves the ${named} bare, but the stroke is left out`, feed);
      continue;
    }
    const detail =
      first.by === "style"
        ? `no stroke on the ${named}, whose style is ${lineStyle}`
        : `no stroke on the ${named}, where the other sides keep the border's weight`;
    root.read(
      property,
      (value) => value,
      () => ({ outcome: "literal", detail }),
      feed
    );
  }
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

/** A box every side of whose border is known to have a used width of 0, so its padding box is its border box. */
const NO_BORDER = "none";

/** A box that paints no background, as {@link paintsNoBackground} proves. */
const NO_BACKGROUND = "no background";

/**
 * Whether a box paints no background: it shows no image, its `background-color` is transparent or
 * unset, it sets no `background-image` but `none`, and no `background` shorthand wins. A color the
 * kit cannot read, such as `CanvasText`, a gradient and a winning shorthand, which the cascade keeps
 * whole and no mapping reads, may each paint a background, so none proves the box clear.
 *
 * @param reader - The box's style.
 * @param image - The picture the box shows, undefined for none.
 * @param fill - The box's fill as `background-color` reads, undefined where it does not map.
 * @returns True where the box paints no background.
 */
function paintsNoBackground(
  reader: LayerStyle,
  image: (() => Uint8Array) | undefined,
  fill: BoxPaint["fill"] | typeof NO_FILL
): boolean {
  return (
    image === undefined &&
    !reader.has("background") &&
    (fill === NO_FILL || !reader.has("background-color")) &&
    (!reader.has("background-image") || normalizeCss(reader.resolved("background-image") ?? "") === "none")
  );
}

/**
 * Read `background-clip: padding-box`, which paints the background inside the border only (CSS
 * Backgrounds 3 §3.7), where Figma paints a fill under the whole frame and its stroke inside it
 * (`strokeAlign` INSIDE), over the fill. The two draw alike in three cases, and the clip drops there:
 *
 * - The box has no border, so its padding box is its border box.
 * - The box paints no background, as a hovered framed Table cell's `bg-transparent` leaves it.
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
 * does a box whose widths lie elsewhere, which knows no side's width, and any other
 * border or value.
 *
 * @param reader - The box's style.
 * @param border - The stroke the box's border draws, undefined where it does not map, or
 *   {@link NO_BORDER} for a box whose every side's width is known to be 0.
 * @param widths - Each side's used width, which gives the side's inset, unknown where `flow` says.
 * @param flow - Where the box's border widths lie, as {@link widthsPlaced} reads them.
 * @param fill - The box's fill, {@link NO_BACKGROUND} for a box that paints none, or undefined where
 *   the background does not map.
 * @param variables - The synced variables, which say whether a color is opaque in every mode.
 * @returns The border's width on each side, where the fill draws inside it, or undefined.
 */
function readBackgroundClip(
  reader: LayerStyle,
  border: StrokeFromBorder | typeof NO_BORDER,
  widths: BorderWidths,
  flow: LogicalSides,
  fill: BoxPaint["fill"] | typeof NO_BACKGROUND,
  variables: VariableIndex
): PaddingBoxInsets | undefined {
  const detail =
    border === NO_BORDER
      ? "the box has no border, so its padding box is its border box"
      : fill === NO_BACKGROUND
        ? "the box paints no background, so the clip has nothing to clip"
        : border !== undefined && !("dashPattern" in border) && opaqueIn(border.color, variables)
          ? "the box's border draws as a solid stroke, opaque in every mode, over the fill beneath it"
          : undefined;
  const clipped = normalizeCss(reader.resolved("background-clip") ?? "") === "padding-box";
  if (detail === undefined && clipped && flow.kind === "elsewhere") {
    reader.mark(
      "background-clip",
      "unmapped",
      `${flow.reason}, so the kit cannot tell where its padding box starts`,
      []
    );
    return undefined;
  }
  const insets =
    detail === undefined &&
    clipped &&
    border !== NO_BORDER &&
    fill !== undefined &&
    fill !== NO_BACKGROUND &&
    fill.kind !== "image"
      ? paddingInsets(border, widths)
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
 * every side's width is a known literal. Undefined for no stroke, a bound or unknown width, or a
 * stroke drawn out of the layout.
 */
function paddingInsets(stroke: StrokeFromBorder, widths: BorderWidths): PaddingBoxInsets | undefined {
  if (stroke === undefined || stroke.inLayout === false) {
    return undefined;
  }
  const { top, right, bottom, left } = widths;
  return top === undefined || right === undefined || bottom === undefined || left === undefined
    ? undefined
    : { top, right, bottom, left };
}

/** The stroke a box's border draws, on every side or some, or undefined where it does not map. */
type StrokeFromBorder = EverySideStroke | BareStroke | SideStroke | undefined;

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

/**
 * A box's used border width on each physical side, in pixels, as {@link readPaint} reads it, or
 * undefined for one that is no literal or that the build cannot place, as on a box whose logical
 * sides lie elsewhere. A reader that adds the border to the box's size, as `held-size.ts` does, takes
 * it from there, so the size and the stroke agree.
 */
export type BorderWidths = Readonly<Record<BorderSide, number | undefined>>;

/**
 * Each side's used width, as its stroke draws it: 0 on a side whose style is `none` or `hidden` or
 * that no declaration gives a width, and a width a shorthand such as `border: 2px solid` sets
 * included.
 */
function usedWidths(borders: SideBorders): BorderWidths {
  return {
    top: borders.top.used,
    right: borders.right.used,
    bottom: borders.bottom.used,
    left: borders.left.used,
  };
}

/** No side's width known. */
const UNKNOWN_WIDTHS: BorderWidths = { top: undefined, right: undefined, bottom: undefined, left: undefined };

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
 * Whether a side draws nothing and neither a longhand nor the side's own shorthand gives it a width:
 * a border shorthand's zero, as preflight's `border: 0 solid`, or no width at all. The stroke notes
 * nothing for it. The side's own shorthand, as `[border-left:2px_hidden_blue]`, sets that side alone,
 * so the stroke notes it.
 */
function unsetSide(border: SideBorder): boolean {
  const property = border.width?.property;
  return (
    border.used === 0 && (property === undefined || (!isLonghand(property) && !SIDE_SHORTHAND.test(property)))
  );
}

/** A border shorthand of one physical side, as `border-left`. */
const SIDE_SHORTHAND = /^border-(?:top|right|bottom|left)$/;

/** Whether a property is a longhand of a box's border, as {@link BORDER_LONGHAND} says. */
function isLonghand(property: string): boolean {
  return BORDER_LONGHAND.test(property);
}

/**
 * Whether two sides take the same width, style and color: the same width and style, as
 * {@link sameWidthAndStyle} reads them, and from one declaration or values that compute alike, as
 * `rgb(255 0 0)` and `#ff0000` are one color. Two colors that bind different variables differ.
 */
function sameBorder(root: LayerStyle, variables: VariableIndex, one: SideBorder, other: SideBorder): boolean {
  const color = (border: SideBorder) => root.resolved(border.color) ?? "";
  return (
    sameWidthAndStyle(variables, one, other) &&
    (one.color === other.color ||
      normalizeCss(color(one)) === normalizeCss(color(other)) ||
      sameColor(readColor(color(one), variables), readColor(color(other), variables)))
  );
}

/**
 * Whether two sides take the same width and style: from one declaration, or values that compute
 * alike, as `calc(1px + 1px)` and `2px` are one width. Two widths that bind different variables
 * differ.
 */
function sameWidthAndStyle(variables: VariableIndex, one: SideBorder, other: SideBorder): boolean {
  const same = (
    left: SideDeclaration | undefined,
    right: SideDeclaration | undefined,
    alike: (left: string, right: string) => boolean
  ): boolean =>
    left?.value === undefined || right?.value === undefined
      ? left?.property === right?.property && left?.value === right?.value
      : normalizeCss(left.value) === normalizeCss(right.value) || alike(left.value, right.value);
  return (
    same(one.width, other.width, (left, right) =>
      sameNumber(readBorderWidth(left, variables), readBorderWidth(right, variables))
    ) && same(one.style, other.style, () => one.lineStyle === other.lineStyle)
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

/** Why a side's width or style that reads stays unmapped where another part of the stroke does not. */
const STROKE_LEFT_OUT = "another side's width, style or color does not map, so the stroke is left out";

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
  // The widths and styles the stroke draws read once it is known to map, so a stroke left out notes
  // none of them as drawn.
  const drawnReads: { readonly property: string; readonly mapped: boolean; readonly read: () => void }[] = [];
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
    drawnReads.push({
      property,
      mapped: weights.every((weight) => weight !== undefined),
      read: () =>
        root.read(
          property,
          () => (weights.every((weight) => weight !== undefined) ? weights : undefined),
          (read) => ({ outcome: "literal", detail: describeSideWidths(drawing, read, collapsed) }),
          stroke
        ),
    });
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
      drawnReads.push({
        property,
        mapped: solid,
        read: () =>
          root.read(
            property,
            (value) => (solid ? value : undefined),
            () => ({ outcome: "literal", detail: "a solid stroke" }),
            stroke
          ),
      });
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
  // A border none of whose sides draws maps as no stroke, and notes its widths so.
  const drawsNone = BORDER_SIDES.every((side) => sides[side] === 0);
  const { color, notes } = resolveSideColor(
    root,
    variables,
    borders,
    BORDER_SIDES.filter((side) => (sides[side] ?? 0) > 0),
    BORDER_SIDES.filter((side) => sides[side] === undefined)
  );
  const maps = BORDER_SIDES.every((side) => sides[side] !== undefined) && (drawsNone || color !== undefined);
  for (const { property, mapped, read } of drawnReads) {
    if (maps || !mapped) {
      read();
    } else {
      root.mark(property, "unmapped", STROKE_LEFT_OUT, stroke);
    }
  }
  noteSideColor(root, variables, notes, stroke);
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
 * A coverage note a side color's resolution plans, which {@link noteSideColor} writes: a mark,
 * unmapped on the stroke or dropped; a declaration the build does not read, noted by a read since
 * the stroke may read the same shorthand's width or style, and a read takes the row over a mark; a
 * color read; or the border color no rule sets, which the width that needs it names.
 */
type ColorNote =
  | {
      readonly kind: "mark";
      readonly property: string;
      readonly outcome: "unmapped" | "dropped";
      readonly detail: string;
    }
  | { readonly kind: "unread"; readonly property: string; readonly detail: string }
  | { readonly kind: "color"; readonly property: string }
  | { readonly kind: "missing"; readonly neededBy: string; readonly detail: string };

/** The one color the sides that draw take, or undefined where the stroke stays out, and its notes. */
type SideColor = { readonly color: ColorSpec | undefined; readonly notes: readonly ColorNote[] };

/**
 * Resolve the color of a stroke on some sides from the sides that draw, noting nothing. Figma
 * strokes every side in one color, so the sides that draw must share one, and a color that reaches
 * only sides of no width draws nothing, as a segment's `border-transparent` beside its
 * `border-s-border` does. A side whose width or style does not map may draw, so its color stays
 * unmapped rather than dropped. A shorthand that wins a drawing side's color, as `border-left` or
 * `border`, stays unmapped, and so does the stroke, since the build reads a color only from a color
 * property. The color is undefined where no side draws, too.
 *
 * @param root - The box's style.
 * @param variables - The synced variables the color can bind.
 * @param borders - Each side's border.
 * @param drawing - The sides that draw.
 * @param unknown - The sides whose width or style does not map, which may draw.
 * @returns The color and the notes {@link noteSideColor} writes.
 */
function resolveSideColor(
  root: LayerStyle,
  variables: VariableIndex,
  borders: SideBorders,
  drawing: readonly BorderSide[],
  unknown: readonly BorderSide[]
): SideColor {
  const drawn = new Set(drawing.map((side) => borders[side].color));
  const unread = new Set(unknown.map((side) => borders[side].color));
  const notes: ColorNote[] = [...unread]
    .filter((property) => !drawn.has(property))
    .map((property) => ({
      kind: "mark",
      property,
      outcome: "unmapped",
      detail: "its side's width or style does not map, so the stroke is left out",
    }));
  const [first = "left"] = drawing;
  if (drawn.has("border-color")) {
    notes.push({
      kind: "missing",
      neededBy: borders[first].width?.property ?? "border-width",
      detail: "no class or base rule colors the border, so the stroke is left out",
    });
  }
  const bare = BORDER_SIDES.flatMap((side) =>
    sideColorProperties(side).filter(
      (property) => root.has(property) && !drawn.has(property) && !unread.has(property)
    )
  );
  for (const property of new Set(bare)) {
    notes.push({
      kind: "mark",
      property,
      outcome: "dropped",
      detail: "it colors only sides the border gives no width, which draw nothing",
    });
  }
  const out = (more: readonly ColorNote[]): SideColor => ({ color: undefined, notes: [...notes, ...more] });
  const each = (detail: string, properties: Iterable<string> = drawn): readonly ColorNote[] =>
    [...properties].map((property) => ({ kind: "mark", property, outcome: "unmapped", detail }));
  // With no side that draws, the box has no stroke, whatever colors it.
  if (drawn.size === 0) {
    return out([]);
  }
  const shorthands = new Set(
    drawing
      .filter((side) => !sideColorProperties(side).includes(borders[side].color))
      .map((side) => borders[side].color)
  );
  if (shorthands.size > 0) {
    return out([
      ...[...shorthands].map((property): ColorNote => ({
        kind: "unread",
        property,
        detail: "a border shorthand colors a side that draws, and the build does not read it",
      })),
      ...each(
        STROKE_LEFT_OUT,
        [...drawn].filter((property) => !shorthands.has(property))
      ),
    ]);
  }
  // A side whose width or style does not map leaves the stroke out, whatever its color.
  if (unread.size > 0) {
    return out(each(STROKE_LEFT_OUT));
  }
  const colors = [...drawn].map((property) => ({
    property,
    color: readColor(root.resolved(property) ?? "", variables),
  }));
  // A color the build cannot read, as `CanvasText`, notes why itself, ahead of any comparison with
  // the others, which a color it reads cannot settle.
  const unreadable = colors.filter(({ color }) => color === undefined).map(({ property }) => property);
  if (unreadable.length > 0) {
    return out([
      ...unreadable.map((property): ColorNote => ({ kind: "color", property })),
      ...each(
        STROKE_LEFT_OUT,
        [...drawn].filter((property) => !unreadable.includes(property))
      ),
    ]);
  }
  if (new Set(colors.map(({ color }) => JSON.stringify(color))).size > 1) {
    return out(each("Figma strokes every side in one color, and the sides that draw take two"));
  }
  const [one] = colors;
  return {
    color: one?.color,
    notes: [...notes, ...[...drawn].map((property): ColorNote => ({ kind: "color", property }))],
  };
}

/** Write the notes {@link resolveSideColor} planned, an unmapped one on the stroke's feed. */
function noteSideColor(
  root: LayerStyle,
  variables: VariableIndex,
  notes: readonly ColorNote[],
  stroke: Feed
): void {
  for (const note of notes) {
    if (note.kind === "mark") {
      root.mark(note.property, note.outcome, note.detail, note.outcome === "unmapped" ? stroke : []);
    } else if (note.kind === "unread") {
      root.read(
        note.property,
        (value) => value,
        () => ({ outcome: "unmapped", detail: note.detail }),
        stroke
      );
    } else if (note.kind === "color") {
      root.read(note.property, (value) => readColor(value, variables), describeColor, stroke);
    } else {
      root.missing("border-color", note.neededBy, note.detail);
    }
  }
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
