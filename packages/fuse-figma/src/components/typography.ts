/**
 * Read a box's type from its computed style: font family, size, line height, weight and letter
 * spacing. A kit label and a text style read their type through these, so the two map each value
 * the same way. A value that spells a synced variable's code syntax binds that variable, and any
 * other value becomes a literal once Tailwind's own variables are substituted.
 */
import { describeNumber, evaluateLength, evaluateNumber, normalizeCss, readNumber } from "./css-values";
import type { VariableIndex } from "./css-values";
import { FONT_WEIGHT_STYLES } from "./kit-spec";
import type { FontWeightSpec, LetterSpacingSpec, LineHeightSpec, NumberSpec, StringSpec } from "./kit-spec";
import type { CoverageNote, LayerStyle } from "./layer-style";

/** A box's type, each field undefined where the style sets none or its value does not map. */
export type TypeReads = {
  readonly fontFamily: StringSpec | undefined;
  readonly fontSize: NumberSpec | undefined;
  readonly lineHeight: LineHeightSpec | undefined;
  readonly fontWeight: FontWeightSpec | undefined;
  readonly letterSpacing: LetterSpacingSpec | undefined;
};

/**
 * Read a box's type, recording each read in the coverage table.
 *
 * @param style - The box's style.
 * @param variables - The synced variables.
 * @param path - The keys of the layer the reads fill.
 * @returns The type.
 */
export function readType(style: LayerStyle, variables: VariableIndex, path: readonly string[]): TypeReads {
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
  const fontWeight = style.read(
    "font-weight",
    (value): FontWeightSpec | undefined => {
      const bound = variables.lookup(value);
      if (bound !== undefined) {
        return { kind: "variable", variable: bound };
      }
      const number = evaluateNumber(value);
      const fontStyle = number === undefined ? undefined : FONT_WEIGHT_STYLES.get(number);
      return fontStyle === undefined ? undefined : { kind: "literal", style: fontStyle };
    },
    (spec): CoverageNote =>
      spec.kind === "variable"
        ? { outcome: "bound", detail: `${spec.variable.collection} / ${spec.variable.name}` }
        : { outcome: "literal", detail: `font style ${spec.style}` },
    style.feed("fontStyle", path)
  );
  return { fontFamily, fontSize, lineHeight, fontWeight, letterSpacing: readLetterSpacing(style, path) };
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
 * @param path - The keys of the layer the read fills.
 * @returns The spacing, or undefined where none maps.
 */
function readLetterSpacing(style: LayerStyle, path: readonly string[]): LetterSpacingSpec | undefined {
  // `normal` is the font's own spacing (CSS Text 3 §8.2), which a Figma text layer draws unset.
  if (normalizeCss(style.resolved("letter-spacing") ?? "") === "normal") {
    style.mark(
      "letter-spacing",
      "dropped",
      "normal spacing is the font's own, which Figma draws by default",
      style.feed("letterSpacing", path)
    );
    return undefined;
  }
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
