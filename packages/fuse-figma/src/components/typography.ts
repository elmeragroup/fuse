/**
 * Read a box's type from its computed style: font family, size, line height, weight and letter
 * spacing. A kit label and a text style read their type through these, so the two map each value
 * the same way. A value that spells a synced variable's code syntax binds that variable, and any
 * other value becomes a literal once Tailwind's own variables are substituted.
 */
import {
  describeNumber,
  evaluateLength,
  evaluateLengthOf,
  evaluateLineHeight,
  evaluateNumber,
  evaluatePercentage,
  normalizeCss,
  readNumber,
  splitTopLevel,
} from "./css-values";
import type { VariableIndex } from "./css-values";
import { FONT_WEIGHT_STYLES } from "./kit-spec";
import type { FontWeightSpec, LetterSpacingSpec, LineHeightSpec, NumberSpec, StringSpec } from "./kit-spec";
import type { AlsoRead, CoverageNote, LayerStyle } from "./layer-style";

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
  const computed = computedLineHeight(style, variables);
  const lineHeight = style.read(
    "line-height",
    () => computed?.line,
    describeLineHeight,
    style.feed("lineHeight", path),
    computed?.also ?? []
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

/**
 * A box's computed line height as {@link computedLineHeight} reads it: a literal in pixels, a synced
 * variable, or a percent of the box's own font size where a variable sets that size.
 */
export type ComputedLineHeight = {
  readonly line: LineHeightSpec;
  /** The box's own properties that set the line height. */
  readonly reads: readonly string[];
  /** The declarations of other elements that set the line height, as the font size a percentage takes. */
  readonly also: readonly AlsoRead[];
};

/**
 * Read a box's computed line height (CSS Inline 3, `line-height`). A value that spells a synced
 * variable binds it. A length is that many pixels. A number multiplies the box's own font size:
 * pixels over a literal size, and Figma's percent of a size a variable sets, which follows the
 * variable in each mode (PH). CSS resolves a percentage against the declaring element's font size.
 * Children inherit that length. So `text-[16px] leading-[150%]` is 24px, and a child at 16px below
 * `text-[20px] leading-[150%]` takes the parent's 30px. Over a synced font size a plain percentage is
 * Figma's percent of the font size, where the box's own font size binds the same variable. CSS
 * clamps a negative `calc()` to 0, and so does the read. A bare negative value is invalid, so a
 * `var()` that substitutes one leaves the box its parent's line height (CSS Variables 1 §3.1).
 * `normal`, a percentage inherited at another synced size, a sum such as `calc(100% + var(--x))`,
 * and a percentage that a product or a quotient takes stay unread.
 *
 * @param style - The box's style.
 * @param variables - The synced variables a line height or font size can bind.
 * @returns The line height, or undefined where none reads.
 */
export function computedLineHeight(
  style: LayerStyle,
  variables: VariableIndex
): ComputedLineHeight | undefined {
  const value = style.resolved("line-height");
  if (value === undefined) {
    return undefined;
  }
  if (isBareNegative(value)) {
    return inheritedLineHeight(style, variables);
  }
  const bound = variables.lookup(value);
  if (bound !== undefined) {
    return { line: { kind: "variable", variable: bound }, reads: ["line-height"], also: [] };
  }
  const read = evaluateLineHeight(value);
  if (read?.kind === "length") {
    return { line: literal(read.px), reads: ["line-height"], also: [] };
  }
  if (read !== undefined) {
    return timesFontSize(read.factor, style, variables);
  }
  if (!percentagesAreTerms(normalizeCss(value))) {
    return undefined;
  }
  const declared = style.whereValueDeclared("line-height", "font-size");
  const font = declared?.value === undefined ? undefined : readNumber(declared.value, variables);
  if (declared === undefined || font === undefined) {
    return undefined;
  }
  // The box's own font size is read beside its line height, so only another element's joins the read.
  const reads = declared.here ? ["line-height", "font-size"] : ["line-height"];
  if (font.kind === "literal") {
    const px = evaluateLengthOf(value, font.value);
    const also = declared.here ? [] : declared.sources;
    return px === undefined ? undefined : { line: literal(px), reads, also };
  }
  // Figma's percent takes the label's own font size, which matches CSS only at the declaring size.
  const own = ownFontSize(style, variables);
  const sameSize =
    own?.kind === "variable" &&
    own.variable.collection === font.variable.collection &&
    own.variable.name === font.variable.name;
  const share = sameSize ? evaluatePercentage(value) : undefined;
  // The declaring element's font size binds the variable the label's percent follows.
  const also = declared.here
    ? []
    : declared.sources.map((source) => ({ ...source, note: describeNumber(font) }));
  return share === undefined ? undefined : { line: percent(share), reads, also };
}

/**
 * Whether each percentage in a value is a term of its own, alone or summed with lengths, as in `150%`,
 * `calc(100% + 4px)` and `max(150%, 20px)`. Chromium does not compute a percentage that a product or
 * a quotient takes against the font size. At 20px it draws `calc(150% * 150% / 20px)` 1125px apart and
 * `calc(24px * 16px / (2 * 50%))` 3.84px apart, where 150% and 50% of 20px would give 45px and 19.2px.
 */
function percentagesAreTerms(expression: string): boolean {
  if (!expression.includes("%")) {
    return true;
  }
  const call = /^(?:calc|min|max)?\(/.exec(expression);
  if (call === null || !expression.endsWith(")")) {
    return /^[+-]?(?:\d+\.?\d*|\.\d+)%$/.test(expression);
  }
  return splitTopLevel(expression.slice(call[0].length, -1), ",").every((argument) =>
    productsOf(argument).every((product) => {
      const factors = splitTopLevel(product, "*").flatMap((factor) => splitTopLevel(factor, "/"));
      return factors.length === 1 ? percentagesAreTerms(product) : !product.includes("%");
    })
  );
}

/** The products a sum adds, split at the spaced `+` and `-` CSS requires, as the evaluator splits them. */
function productsOf(sum: string): readonly string[] {
  const products: string[][] = [[]];
  for (const token of splitTopLevel(sum, " ")) {
    if (token === "+" || token === "-") {
      products.push([]);
    } else {
      products.at(-1)?.push(token);
    }
  }
  return products.map((tokens) => tokens.join(""));
}

/** Whether a line height is a negative number, length or percentage outside a math function. */
function isBareNegative(value: string): boolean {
  const normalized = normalizeCss(value);
  return !normalized.includes("(") && (evaluateNumber(normalized) ?? 0) < 0;
}

/**
 * The line height a box takes from its parent, where its own declaration is invalid at computed-value
 * time and so acts as `unset`, which inherits (CSS Cascade 4 §7.3). A parent's number multiplies the
 * box's own font size, and a length is the parent's. A percent of the parent's synced font size
 * stays unread, since the box's own font size can differ. The read credits the parent's line height,
 * and the parent's font size where its percentage takes that size.
 */
function inheritedLineHeight(style: LayerStyle, variables: VariableIndex): ComputedLineHeight | undefined {
  // An ancestor whose own value is invalid passes down what it inherits in turn.
  let parent = style.parent();
  while (parent !== undefined && isBareNegative(parent.resolved("line-height") ?? "")) {
    parent = parent.parent();
  }
  if (parent === undefined) {
    return undefined;
  }
  const passed = parent.resolved("line-height");
  const read = passed === undefined ? undefined : evaluateLineHeight(passed);
  const sourcesOf = (property: string) => parent.whereValueDeclared(property, property)?.sources ?? [];
  if (read?.kind === "factor") {
    const own = timesFontSize(read.factor, style, variables);
    return own === undefined ? undefined : { ...own, also: sourcesOf("line-height") };
  }
  const computed = computedLineHeight(parent, variables);
  if (computed === undefined || computed.line.kind === "percent") {
    return undefined;
  }
  const also = [...computed.reads.flatMap(sourcesOf), ...computed.also];
  return { line: computed.line, reads: ["line-height"], also };
}

/** The box's own font size, as a synced variable or pixels. */
function ownFontSize(style: LayerStyle, variables: VariableIndex): NumberSpec | undefined {
  const size = style.resolved("font-size");
  return size === undefined ? undefined : readNumber(size, variables);
}

/** A unitless line height times the box's own font size. */
function timesFontSize(
  factor: number,
  style: LayerStyle,
  variables: VariableIndex
): ComputedLineHeight | undefined {
  const own = ownFontSize(style, variables);
  if (own === undefined) {
    return undefined;
  }
  const line = own.kind === "literal" ? literal(factor * own.value) : percent(factor);
  return { line, reads: ["line-height", "font-size"], also: [] };
}

/** A line height in pixels, clamped at 0 as CSS clamps a computed line height. */
function literal(px: number): LineHeightSpec {
  return { kind: "literal", value: Math.max(0, px) };
}

/** A line height as a share of the font size, clamped at 0 as CSS clamps a computed line height. */
function percent(share: number): LineHeightSpec {
  return { kind: "percent", value: Math.max(0, share) * 100 };
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
  const declared = style.whereValueDeclared("letter-spacing", "font-size")?.value;
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
