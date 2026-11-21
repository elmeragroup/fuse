/**
 * The local text styles the plugin keeps in the file: one per type the Text, Heading and Span
 * components draw. The kit draws no component set for these three, so designers set their type with
 * these styles.
 *
 * Each style's type comes from `captures/text-styles.json`. `figma:capture` takes it in Chromium from
 * the samples `text-style-samples.ts` lists, one real `Text`, `Span` or `Heading` per recipe
 * combination. The capture cascade (`capture-cascade.ts`) applies the winning declarations of each
 * sample's root over what the page passes down, as it does for the root of a component set.
 * `readType` in `typography.ts` reads the resulting type with the reads a kit label uses. The style
 * also takes the root's `text-transform`, `text-decoration-line` and `text-wrap-style`, each Figma's
 * default where the cascade sets none.
 *
 * Names follow the scheme `<Component>/<size>/<weight>`, with the recipe's `default` size named for
 * the `base` step it draws and the weight named for its Figma style in lowercase, such as
 * `Text/base/regular`. Heading's three themed levels are `Heading/1` to `Heading/3`, whose size,
 * line height and weight follow the theme. Two samples that draw the same type, such as Text's
 * `bold`, which caps body text at `medium`, give one style.
 */
import { CaptureSetCascade } from "../capture/capture-cascade";
import type { SetCapture } from "../capture/capture-format";
import { KitUnmappable } from "./build-errors";
import type { BuildContext } from "./component-spec";
import { normalizeCss } from "./css-values";
import { TEXT_STYLE_KEY_PREFIX } from "./kit-spec";
import type { TextStyleSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";
import { sampleCell, TEXT_STYLE_CAPTURE, TEXT_STYLE_SAMPLES } from "./text-style-samples";
import type { TextStyleSample } from "./text-style-samples";
import { readType } from "./typography";

/** Each `text-transform` the cascade can give, as the text case Figma holds. */
const TEXT_CASES = new Map<string, TextStyleSpec["textCase"]>([
  ["none", "ORIGINAL"],
  ["uppercase", "UPPER"],
  ["lowercase", "LOWER"],
  ["capitalize", "TITLE"],
]);

/** Each `text-decoration-line` the cascade can give, as the decoration Figma holds. */
const TEXT_DECORATIONS = new Map<string, TextStyleSpec["textDecoration"]>([
  ["none", "NONE"],
  ["underline", "UNDERLINE"],
  ["line-through", "STRIKETHROUGH"],
]);

/** Each `text-wrap-style` the cascade can give, as the wrap style Figma holds. */
const TEXT_WRAP_STYLES = new Map<string, TextStyleSpec["textWrapStyle"]>([
  ["auto", "AUTO"],
  ["balance", "BALANCE"],
  ["pretty", "PRETTY"],
]);

/** No letter spacing, Figma's default and the CSS initial `normal`. */
const NO_SPACING = { unit: "PERCENT", value: 0 } as const;

/**
 * Read a keyword property into a Figma field: the field for its initial value where the cascade sets
 * none, and undefined for a value the table lacks.
 */
function readKeyword<Field>(
  style: LayerStyle,
  property: string,
  table: ReadonlyMap<string, Field>,
  initial: Field
): Field | undefined {
  if (!style.has(property)) {
    return initial;
  }
  return style.read(
    property,
    (value) => table.get(normalizeCss(value)),
    (field) => ({ outcome: "literal", detail: String(field) }),
    // A text style is no layer, so the read fills no layer's field.
    []
  );
}

/**
 * Read one style's type from its sample's captured root, through the layer style the kit's component
 * sets read through.
 *
 * @returns The style.
 * @throws `KitUnmappable` where the capture lacks the sample's cell or the sample gives a field the
 *   kit cannot draw.
 */
function readStyle(
  sample: TextStyleSample,
  cascade: CaptureSetCascade,
  context: BuildContext
): TextStyleSpec {
  const label = sample.path.join("/");
  const style = cascade.cell(sampleCell(sample)).root("text style").style;
  const type = readType(style, context.variables, []);
  const textCase = readKeyword(style, "text-transform", TEXT_CASES, "ORIGINAL");
  const textDecoration = readKeyword(style, "text-decoration-line", TEXT_DECORATIONS, "NONE");
  const textWrapStyle = readKeyword(style, "text-wrap-style", TEXT_WRAP_STYLES, "AUTO");
  const { fontFamily, fontSize, lineHeight, fontWeight } = type;
  if (
    fontFamily === undefined ||
    fontSize === undefined ||
    lineHeight === undefined ||
    fontWeight === undefined ||
    textCase === undefined ||
    textDecoration === undefined ||
    textWrapStyle === undefined
  ) {
    throw new KitUnmappable({
      message: `the text style ${label}: its sample gives no font family, size, line height, weight, case, decoration or wrap the kit can draw`,
    });
  }
  // `normal` is the font's own spacing, which `readType` leaves undefined and Figma draws as none.
  const normalSpacing = normalizeCss(style.resolved("letter-spacing") ?? "") === "normal";
  if (style.has("letter-spacing") && !normalSpacing && type.letterSpacing === undefined) {
    throw new KitUnmappable({ message: `the text style ${label}: its letter spacing does not map` });
  }
  const name = fontWeight.kind === "literal" ? `${label}/${fontWeight.style.toLowerCase()}` : label;
  return {
    key: `${TEXT_STYLE_KEY_PREFIX}${name.toLowerCase()}`,
    name,
    description: sample.description,
    fontFamily,
    fontWeight,
    fontSize,
    lineHeight,
    letterSpacing: type.letterSpacing ?? NO_SPACING,
    textCase,
    textDecoration,
    textWrapStyle,
  };
}

/** Whether two styles draw the same type. */
function sameType(left: TextStyleSpec, right: TextStyleSpec): boolean {
  const { key: _leftKey, name: _leftName, description: _leftDescription, ...leftType } = left;
  const { key: _rightKey, name: _rightName, description: _rightDescription, ...rightType } = right;
  return JSON.stringify(leftType) === JSON.stringify(rightType);
}

/**
 * Build the text styles from the capture of the Text, Heading and Span samples. No component set
 * draws the samples, so the coverage table holds no row for them.
 *
 * @param capture - The kept capture of the samples.
 * @param context - The context the component sets were built with, whose compile holds the
 *   capture's classes.
 * @returns Heading's styles, then Text's, then Span's. Two samples that draw the same type, and so
 *   get the same name, give one style.
 * @throws `KitUnmappable` where the capture lacks a sample, where a sample gives a type the kit
 *   cannot draw, or where two samples give one name two types. `buildKit` catches it.
 */
export function buildTextStyles(capture: SetCapture, context: BuildContext): readonly TextStyleSpec[] {
  const cascade = new CaptureSetCascade({ capture, definition: TEXT_STYLE_CAPTURE, context });
  const styles = new Map<string, TextStyleSpec>();
  for (const sample of TEXT_STYLE_SAMPLES) {
    const style = readStyle(sample, cascade, context);
    const named = styles.get(style.key);
    if (named === undefined) {
      styles.set(style.key, style);
    } else if (!sameType(named, style)) {
      throw new KitUnmappable({
        message: `the text style ${style.name}: two of its samples draw different types under one name`,
      });
    }
  }
  return [...styles.values()];
}
