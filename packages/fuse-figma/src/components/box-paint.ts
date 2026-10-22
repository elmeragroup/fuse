/**
 * How a box paints, read from its style: its fill, or the picture it shows, its stroke, its drop
 * shadows, and an outline that paints nothing. `component-spec.ts` maps a box's layout and layers,
 * and asks this module for the box's paint and for the coverage note of a color it reads itself,
 * such as a text color.
 */
import { createHash } from "node:crypto";

import type { CoverageNote, LayerStyle } from "./cascade";
import { describeNumber, normalizeCss, readColor, readNumber, readShadows } from "./css-values";
import type { VariableIndex } from "./css-values";
import type { BoxSpec, ColorSpec, ImagePaintSpec, ShadowSpec, StrokeSpec } from "./kit-spec";

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
  const stroke = readStroke(reader, variables);
  readClearOutline(reader, variables);
  const shadows = readShadowStack(reader, variables);
  const fill =
    image === undefined
      ? reader.read("background-color", (value) => readFill(value, variables), describeFill)
      : readImage(reader, image, variant);
  return { fill: fill === NO_FILL ? undefined : fill, stroke, shadows };
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
    throw new Error(
      `${variant}: a box that shows an image needs object-fit: cover, which an image paint at FILL draws`
    );
  }
  const scaleMode = reader.read(
    "object-fit",
    (value) => (normalizeCss(value) === "cover" ? ("FILL" as const) : undefined),
    () => ({
      outcome: "literal",
      detail: "the image covers the box and crops what overflows, an image paint at FILL",
    })
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
 * stays unread, and so unmapped, since Figma draws no outline.
 */
function readClearOutline(reader: LayerStyle, index: VariableIndex): void {
  const color = readColor(reader.resolved("outline-color") ?? "", index);
  if (color?.kind !== "literal" || color.color.a !== 0) {
    return;
  }
  for (const property of ["outline-style", "outline-width", "outline-offset", "outline-color"]) {
    reader.read(
      property,
      (value) => value,
      () => ({ outcome: "dropped", detail: "the outline is transparent, so it paints nothing" })
    );
  }
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
  const describe = (mapped: readonly ShadowSpec[]) => ({
    outcome: mapped.some((shadow) => shadow.color.kind === "variable")
      ? ("bound" as const)
      : ("literal" as const),
    detail: mapped.length === 0 ? "no visible shadow" : `${mapped.length} drop shadow(s)`,
  });
  if (normalizeCss(raw) !== TAILWIND_SHADOW_STACK) {
    return root.read("box-shadow", (value) => readShadows(value, variables), describe) ?? [];
  }
  root.mark("box-shadow", "literal", "Tailwind's shadow stack, read layer by layer");
  return TAILWIND_SHADOW_LAYERS.flatMap((layer) =>
    root.has(layer) ? (root.read(layer, (value) => readShadows(value, variables), describe) ?? []) : []
  );
}

/**
 * A CSS border becomes an inside stroke. A border with no style or a style other than solid
 * stays unmapped, and so does one with no color, which would otherwise draw no stroke and leave
 * no row.
 */
function readStroke(root: LayerStyle, variables: VariableIndex): StrokeSpec | undefined {
  if (!root.has("border-width")) {
    return undefined;
  }
  root.missing(
    "border-color",
    "border-width",
    "no class or base rule colors the border, so the stroke is left out"
  );
  const style = root.read(
    "border-style",
    (value) => (normalizeCss(value) === "solid" ? value : undefined),
    () => ({ outcome: "literal", detail: "a solid stroke" })
  );
  const weight = root.read("border-width", (value) => readNumber(value, variables), describeNumber);
  const color = root.read("border-color", (value) => readColor(value, variables), describeColor);
  return style === undefined || weight === undefined || color === undefined ? undefined : { color, weight };
}
