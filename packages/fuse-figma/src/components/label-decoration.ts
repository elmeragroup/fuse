/**
 * The line a label's `text-decoration-line` draws: an underline with its offset, thickness and
 * color, or a line through the text in the text's own fill. `label-layout.ts` reads a label's
 * decoration here, and a span's underline inside it.
 */

import { describeColor } from "./box-paint";
import {
  evaluateLength,
  evaluateLengthOf,
  evaluateNumber,
  inFont,
  normalizeCss,
  readColor,
  splitTopLevel,
} from "./css-values";
import type { VariableIndex } from "./css-values";
import type { ColorSpec, NumberSpec, TextLayerSpec } from "./kit-spec";
import type { CoverageNote, LayerStyle } from "./layer-style";

/**
 * A `text-decoration-color` as the kit draws it: in the text's own fill, or in a paint. `dark` is
 * the dark arm of a `light-dark()` whose arms differ, which the paint leaves out.
 */
type DecorationColor =
  | { readonly kind: "text" }
  | { readonly kind: "paint"; readonly color: ColorSpec; readonly dark: string | undefined };

/** The two arms of a `light-dark(<light>, <dark>)`, or undefined for any other value. */
function lightDarkArms(value: string): { readonly light: string; readonly dark: string } | undefined {
  if (!value.startsWith("light-dark(") || !value.endsWith(")")) {
    return undefined;
  }
  const [light, dark, ...rest] = splitTopLevel(value.slice("light-dark(".length, -1), ",");
  return light === undefined || dark === undefined || rest.length > 0
    ? undefined
    : { light: light.trim(), dark: dark.trim() };
}

/**
 * Read an underline's color. `currentcolor` is the text's own color, which Figma's `AUTO` draws, and
 * inside a mix it stands for the text color the box resolves, so Link's resting
 * `color-mix(in oklab, currentcolor 35%, transparent)` binds the role tint of its text color, such
 * as `foreground/35`.
 *
 * A `light-dark()` draws the light arm. A Figma paint bound to a variable takes its opacity from the
 * variable's alpha, as the fake's rule 1 models, and a role tint holds one share of its role in every
 * mode, so the kit cannot draw a share that changes with the scheme. Link's 65% in a dark
 * scheme therefore draws at the light scheme's 35% in a Dark preview, and the coverage row says so.
 *
 * @param value - The compiled `text-decoration-color`.
 * @param textColor - The box's resolved `color`, which `currentcolor` takes.
 * @param variables - The synced variables.
 * @returns The color, or undefined for one the reader cannot express.
 */
function readDecorationColor(
  value: string,
  textColor: string | undefined,
  variables: VariableIndex
): DecorationColor | undefined {
  // CSS keywords match ASCII case-insensitively, and the built CSS a capture reads writes `currentColor`.
  const normalized = normalizeCss(value).replaceAll(/currentcolor/giu, "currentcolor");
  const arms = lightDarkArms(normalized);
  const light = arms?.light ?? normalized;
  const dark = arms === undefined || arms.dark === arms.light ? undefined : arms.dark;
  if (light === "currentcolor") {
    return dark === undefined ? { kind: "text" } : undefined;
  }
  if (light.includes("currentcolor") && textColor === undefined) {
    return undefined;
  }
  const color = readColor(light.replaceAll("currentcolor", textColor ?? ""), variables);
  return color === undefined ? undefined : { kind: "paint", color, dark };
}

function describeDecorationColor(read: DecorationColor): CoverageNote {
  if (read.kind === "text") {
    return { outcome: "literal", detail: "an underline in the text's own color (AUTO)" };
  }
  const note = describeColor(read.color);
  return read.dark === undefined
    ? note
    : {
        outcome: note.outcome,
        detail: `${note.detail}, the light scheme's arm. The dark arm ${read.dark} is not drawn: a role tint holds one share in every mode, so a Dark preview draws the light share`,
      };
}

/** The line a label's `text-decoration-line` draws: under its text, through it, or none. */
type Decoration = Pick<TextLayerSpec, "underline" | "strikethrough">;

/**
 * Read the line a label's `text-decoration-line` draws. An underline keeps its offset, thickness
 * and color. A Figma text drawn `STRIKETHROUGH` takes neither a thickness nor a color of its own,
 * since Figma holds those only while a text is underlined, and draws its line in the text's own
 * fill at a thickness Figma chooses. So `line-through` maps only where its color is the text's own
 * and its thickness is `auto`, which leaves the thickness to the browser (CSS Text Decoration 4
 * §2.4), as an unset underline thickness keeps Figma's automatic one. Any other line, or two lines
 * at once, stays unmapped.
 */
export function readDecoration(
  style: LayerStyle,
  fontSize: NumberSpec | undefined,
  variables: VariableIndex,
  path: readonly string[]
): Decoration {
  // A line through the text draws only where its color and thickness do, so they read first, and
  // the line stays unmapped where either does not map.
  const through =
    DECORATION_LINES.get(normalizeCss(style.resolved("text-decoration-line") ?? "")) === "line-through";
  const drawsThrough = through && strikes(style, variables, path);
  const line = style.read(
    "text-decoration-line",
    (value) => {
      const read = DECORATION_LINES.get(normalizeCss(value));
      return read === "line-through" && !drawsThrough ? undefined : read;
    },
    (drawn) => ({ outcome: "literal", detail: DRAWN_LINE[drawn] }),
    style.feed(through ? "strikethrough" : "underline", path)
  );
  if (line !== "underline") {
    for (const property of ["text-underline-offset", "text-decoration-thickness", "text-decoration-color"]) {
      if (!through || property === "text-underline-offset") {
        style.mark(property, "dropped", "the cell draws no underline", []);
      }
    }
    return drawsThrough ? { underline: undefined, strikethrough: true } : { underline: undefined };
  }
  // An `em` length takes the label's font size, which only a literal size gives in pixels.
  const inPixels = (value: string) =>
    fontSize?.kind === "literal" ? evaluateLength(inFont(value, fontSize.value)) : evaluateNumber(value);
  // An `em` offset computes to an absolute length where it is declared (CSS Text Decoration 4 §2.8),
  // so it takes the font size of the element whose declaration the label inherits, past any
  // `inherit`, while a percentage, a share of 1em, passes down as one and takes the label's own.
  // Where either size is no length in pixels, an offset that needs it stays unmapped.
  const declared = style.whereValueDeclared("text-underline-offset", "font-size");
  const declaringFont = evaluateLength(declared?.value ?? "");
  const labelFont = fontSize?.kind === "literal" ? fontSize.value : undefined;
  const offsetPixels = (value: string) => {
    const lengths = declaringFont === undefined ? value : inFont(value, declaringFont);
    return labelFont === undefined ? evaluateLength(lengths) : evaluateLengthOf(lengths, labelFont);
  };
  // An `em` the label takes from another element reads that element's font size, which the
  // offset's row then accounts for. The label's own `em` takes its own size, which its type reads.
  const offsetReads =
    declared?.here === false && /[\d.]em\b/.test(style.resolved("text-underline-offset") ?? "")
      ? declared.sources
      : [];
  const textColor = style.resolved("color");
  const underlineColor = style.read(
    "text-decoration-color",
    (value) => readDecorationColor(value, textColor, variables),
    describeDecorationColor,
    style.feed("underline", path)
  );
  return {
    underline: {
      offset: style.read(
        "text-underline-offset",
        offsetPixels,
        (offset) => ({ outcome: "literal", detail: `an underline offset of ${offset}px` }),
        style.feed("underline", path),
        offsetReads
      ),
      thickness: style.read(
        "text-decoration-thickness",
        inPixels,
        (thickness) => ({ outcome: "literal", detail: `an underline ${thickness}px thick` }),
        style.feed("underline", path)
      ),
      color: underlineColor?.kind === "paint" ? underlineColor.color : undefined,
    },
  };
}

/** The `text-decoration-line` values a label draws, as the kit names them. */
const DECORATION_LINES: ReadonlyMap<string, DecorationLine> = new Map([
  ["none", "none"],
  ["underline", "underline"],
  ["line-through", "line-through"],
]);

/** A line a label draws. */
type DecorationLine = "none" | "underline" | "line-through";

/** How each line a label draws reads in a coverage detail. */
const DRAWN_LINE = {
  none: "no decoration",
  underline: "an underline",
  "line-through": "a line through the text",
} as const satisfies Record<DecorationLine, string>;

/**
 * Read a line through a label's text: whether its color is the text's own and its thickness `auto`.
 * Where either is not, it stays unmapped.
 */
function strikes(style: LayerStyle, variables: VariableIndex, path: readonly string[]): boolean {
  const textColor = style.resolved("color");
  const color = style.read(
    "text-decoration-color",
    (value) => {
      const read = readDecorationColor(value, textColor, variables);
      return read?.kind === "text" ? read : undefined;
    },
    () => ({
      outcome: "literal",
      detail: "a line in the text's own color, as Figma draws a line through a text",
    }),
    style.feed("strikethrough", path)
  );
  const thickness = style.read(
    "text-decoration-thickness",
    (value) => (normalizeCss(value) === "auto" ? value : undefined),
    () => ({
      outcome: "literal",
      detail: "the thickness the renderer chooses, as Figma draws a line through a text",
    }),
    style.feed("strikethrough", path)
  );
  const colorOwn = color !== undefined || !style.has("text-decoration-color");
  const thicknessOwn = thickness !== undefined || !style.has("text-decoration-thickness");
  return colorOwn && thicknessOwn;
}
