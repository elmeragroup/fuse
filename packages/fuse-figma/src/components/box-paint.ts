/**
 * How a box paints, read from its style: its fill, or the picture it shows, its stroke, its drop
 * shadows, and an outline that paints nothing. `box-mapping.ts` maps a box's layout and layers,
 * and asks this module for the box's paint and for the coverage note of a color it reads itself,
 * such as a text color.
 */
import { createHash } from "node:crypto";

import { KitUnmappable } from "./build-errors";
import type { CoverageNote, LayerStyle } from "./cascade";
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
} from "./kit-spec";

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

/** A box's paint: its fill, its stroke and its drop shadows. */
export type BoxPaint = Pick<BoxSpec, "fill" | "stroke" | "shadows">;

/**
 * Read how a box paints. A box that shows a picture fills with it, and any other box with its
 * background. Reading the paint also drops an outline that paints nothing.
 *
 * @param reader - The box's style.
 * @param image - The bytes of the picture the box shows, or undefined for a box that shows none.
 * @param variables - The synced variables a paint can bind.
 * @param variant - The cell's variant key, for the error.
 * @returns The box's fill, stroke and shadows.
 * @throws When a box that shows a picture sets no `object-fit`, as {@link readImage} says.
 */
export function readPaint(
  reader: LayerStyle,
  image: (() => Uint8Array) | undefined,
  variables: VariableIndex,
  variant: string
): BoxPaint {
  const sided = BORDER_SIDES.some((side) => setsSide(reader, side));
  const border =
    reader.has("border-width") && !(sided && zeroesEverySide(reader, variables))
      ? readStroke(reader, variables)
      : readSideStroke(reader, variables);
  const cleared = readClearOutline(reader, variables);
  // A box holds one stroke, so its border keeps it.
  const bordered = reader.has("border-width") || sided;
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
  return { fill: fill === NO_FILL ? undefined : fill, stroke, shadows };
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
 * A CSS border becomes an inside stroke. A solid border draws a solid stroke, and a dashed one a
 * dashed stroke, as {@link dashesOf} says. A border with no style or any other style stays
 * unmapped, and so does one with no color, which would otherwise draw no stroke and leave no row. A
 * border of no width paints nothing whatever its style and color (CSS Backgrounds 3 §3), as a
 * Sidebar row's `border-0` resets its `<button>`'s, so it draws no stroke.
 */
function readStroke(root: LayerStyle, variables: VariableIndex): EverySideStroke | undefined {
  if (!root.has("border-width")) {
    return undefined;
  }
  const width = readNumber(root.resolved("border-width") ?? "", variables);
  if (width?.kind === "literal" && width.value === 0) {
    root.read(
      "border-width",
      (value) => value,
      () => ({ outcome: "literal", detail: "no stroke" }),
      root.feed("stroke")
    );
    for (const property of ["border-style", "border-color"]) {
      root.mark(property, "dropped", "the border has no width, so it draws nothing", []);
    }
    return undefined;
  }
  root.missing(
    "border-color",
    "border-width",
    "no class or base rule colors the border, so the stroke is left out"
  );
  const stroke = root.feed("stroke");
  const weight = root.read("border-width", (value) => readNumber(value, variables), describeNumber, stroke);
  const style = root.read(
    "border-style",
    (value) => borderStyle(normalizeCss(value), weight),
    (read) => ({ outcome: "literal", detail: read.detail }),
    stroke
  );
  const color = root.read("border-color", (value) => readColor(value, variables), describeColor, stroke);
  if (style === undefined || weight === undefined || color === undefined) {
    return undefined;
  }
  return style.dashPattern === undefined
    ? { color, weight }
    : { color, weight, dashPattern: style.dashPattern };
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

/** Whether a box sets a border width on a side of its own, by its physical or its logical name. */
function setsSide(root: LayerStyle, side: BorderSide): boolean {
  return root.has(sideWidth(side)) || root.has(`border-${LOGICAL_SIDE[side]}-width`);
}

/** Whether a box's `border-width` is a literal zero, as `border-0` writes it. */
function zeroesEverySide(root: LayerStyle, variables: VariableIndex): boolean {
  const width = readNumber(root.resolved("border-width") ?? "", variables);
  return width?.kind === "literal" && width.value === 0;
}

/** The name a box's border on a side goes by: its physical name, or its logical one where it sets that. */
const sideName = (root: LayerStyle, side: BorderSide): string =>
  root.has(`border-${side}-width`) ? side : LOGICAL_SIDE[side];

const sideWidth = (side: BorderSide) => `border-${side}-width`;

/**
 * A CSS border on some sides becomes a solid stroke with a weight on each side, as `border-r` draws
 * the Sidebar container's edge and `border-s` a Number field stepper's start edge, and each side's weight takes room on that side (PS). Each side's literal width counts, and a side the box sets no
 * width on draws nothing, since Tailwind preflight's `border: 0 solid` leaves it 0, or a `border-0`
 * before the side's own width does. A box that also sets a `border-width` other than 0 takes the
 * stroke {@link readStroke} reads, and its sides stay unread, and so unmapped. A side's width that is no literal, a style other than solid, or no color leaves the
 * stroke out, with the sides that do not map unmapped.
 */
function readSideStroke(root: LayerStyle, variables: VariableIndex): SideStroke | undefined {
  const given = BORDER_SIDES.filter((side) => setsSide(root, side));
  const [first] = given;
  if (first === undefined) {
    return undefined;
  }
  // `border-0` before a side's own width, as a Number field stepper's `border-0 border-s`, zeroes the
  // sides the box sets no width on; Tailwind writes the side's utility after it, so the side wins.
  root.read(
    "border-width",
    (value) => value,
    () => ({ outcome: "literal", detail: "no stroke on the sides the box sets no width of its own on" }),
    root.feed("stroke")
  );
  root.mark(
    "border-style",
    "dropped",
    "each side the box sets a width of its own on reads its own style",
    []
  );
  root.missing(
    "border-color",
    `border-${sideName(root, first)}-width`,
    "no class or base rule colors the border, so the stroke is left out"
  );
  const stroke = root.feed("stroke");
  const sides = { top: 0, right: 0, bottom: 0, left: 0 };
  let complete = true;
  for (const side of given) {
    const name = sideName(root, side);
    const width = root.read(
      `border-${name}-width`,
      (value) => {
        const read = readNumber(value, variables);
        return read?.kind === "literal" && read.value >= 0 ? read.value : undefined;
      },
      (weight) => ({
        outcome: "literal",
        detail: `a ${weight}px ${side} stroke that takes its room on that side (PS)`,
      }),
      stroke
    );
    const solid = root.read(
      `border-${name}-style`,
      (value) => (normalizeCss(value) === "solid" ? value : undefined),
      () => ({ outcome: "literal", detail: "a solid stroke" }),
      stroke
    );
    if (width === undefined || solid === undefined) {
      complete = false;
    } else {
      sides[side] = width;
    }
  }
  const color = root.read("border-color", (value) => readColor(value, variables), describeColor, stroke);
  return complete && color !== undefined ? { color, sides } : undefined;
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
