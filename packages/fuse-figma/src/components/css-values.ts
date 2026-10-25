/**
 * Read compiled CSS values as Figma fields. A value that is exactly a synced variable's web
 * code syntax binds that variable. Any other value must reduce to a number or a color once
 * Tailwind's own variables are substituted, or it stays unmapped.
 */
import * as CssColor from "@elmeragroup/color/css-color";
import * as Srgb from "@elmeragroup/color/srgb";

import type { CoverageRow } from "./coverage";
import type { ColorSpec, NumberSpec, ShadowSpec, SizeSpec, VariableRef } from "./kit-spec";

/** The root font size the catalog assumes when it turns `rem` into pixels. */
const ROOT_FONT_SIZE_PX = 16;

/**
 * Finds the synced variable whose web code syntax a CSS value spells. The sync writes
 * `var(--primary)` for a token and the rung's `calc()` for a radius rung.
 */
export type VariableIndex = {
  readonly lookup: (value: string) => VariableRef | undefined;
  /**
   * The synced variable whose code syntax is the same affine length as a value the builder made
   * itself, such as a padding less a margin, which no class spells the way the formula does.
   * Undefined where none is, or the value is no affine length.
   */
  readonly lookupAffine: (value: string) => VariableRef | undefined;
  /** The smallest value a FLOAT variable holds in any mode, or undefined when unknown. */
  readonly minimum: (ref: VariableRef) => number | undefined;
  /** The largest value a FLOAT variable holds in any mode, or undefined when unknown. */
  readonly maximum: (ref: VariableRef) => number | undefined;
  /** Whether a custom property is a synced variable, which substitution must keep. */
  readonly owns: (customProperty: string) => boolean;
};

/**
 * Index synced variables by their web code syntax.
 *
 * @param variables - Each synced variable with the code syntax the sync writes for it, and the
 *   smallest and largest values it holds in any mode when it is a FLOAT variable.
 * @returns The index.
 */
export function makeVariableIndex(
  variables: readonly {
    readonly ref: VariableRef;
    readonly webSyntax: string;
    readonly minimum?: number | undefined;
    readonly maximum?: number | undefined;
  }[]
): VariableIndex {
  const owned = new Set<string>();
  for (const { webSyntax } of variables) {
    const single = singleVar(webSyntax);
    if (single !== undefined) {
      owned.add(single.name);
    }
  }
  // The builder reads values with Tailwind's variables substituted, which drops the fallback of
  // every synced variable, so the index compares code syntax the same way.
  const canonical = (value: string): string =>
    normalizeCss(
      substituteVars(
        value,
        () => undefined,
        (name) => owned.has(name),
        new Set()
      ) ?? value
    );
  const bySyntax = new Map<string, VariableRef>();
  const minimums = new Map<string, number>();
  const maximums = new Map<string, number>();
  for (const { ref, webSyntax, minimum, maximum } of variables) {
    bySyntax.set(canonical(webSyntax), ref);
    if (minimum !== undefined) {
      minimums.set(refKey(ref), minimum);
    }
    if (maximum !== undefined) {
      maximums.set(refKey(ref), maximum);
    }
  }
  const byAffine = [...bySyntax].flatMap(([syntax, ref]) => {
    const length = affineLength(syntax);
    return length === undefined || length.coefficients.size === 0 ? [] : [{ length, ref }];
  });
  return {
    lookup: (value) => bySyntax.get(canonical(value)),
    lookupAffine: (value) => {
      const length = affineLength(canonical(value));
      return length === undefined
        ? undefined
        : byAffine.find((entry) => sameAffine(entry.length, length))?.ref;
    },
    minimum: (ref) => minimums.get(refKey(ref)),
    maximum: (ref) => maximums.get(refKey(ref)),
    owns: (customProperty) => owned.has(customProperty),
  };
}

/**
 * The synced variables as one mode of a collection resolves them: each variable `pin` answers for
 * holds that mode's least and greatest value, and every other keeps its bounds across all modes.
 * Lookups by code syntax stay the same.
 *
 * @param index - The synced variables.
 * @param pin - The bounds a variable holds in the mode, or undefined for one the mode leaves alone.
 * @returns The variables in the mode.
 */
export function pinnedIndex(
  index: VariableIndex,
  pin: (ref: VariableRef) => { readonly minimum: number; readonly maximum: number } | undefined
): VariableIndex {
  return {
    ...index,
    minimum: (ref) => pin(ref)?.minimum ?? index.minimum(ref),
    maximum: (ref) => pin(ref)?.maximum ?? index.maximum(ref),
  };
}

/** One mode of a collection, named as `Collection / Mode`, with the variables as it resolves them. */
export type ModeView = { readonly name: string; readonly variables: VariableIndex };

function refKey(ref: VariableRef): string {
  return `${ref.collection}/${ref.name}`;
}

/**
 * Collapse the whitespace CSS ignores, so two spellings of one value compare equal.
 *
 * @param value - A CSS value.
 * @returns The value with single spaces and none inside parentheses or around commas.
 */
export function normalizeCss(value: string): string {
  return value
    .trim()
    .replaceAll(/\s+/g, " ")
    .replaceAll(/\(\s+/g, "(")
    .replaceAll(/\s+\)/g, ")")
    .replaceAll(/\s*,\s*/g, ",");
}

type VarCall = { readonly name: string; readonly fallback: string | undefined };

/** The `var()` a whole value consists of, such as `var(--x,1px)`, or undefined. */
function singleVar(value: string): VarCall | undefined {
  const trimmed = value.trim();
  if (!trimmed.startsWith("var(") || matchingParen(trimmed, 3) !== trimmed.length - 1) {
    return undefined;
  }
  const inner = trimmed.slice(4, -1);
  const comma = topLevelIndex(inner, ",");
  return comma === -1
    ? { name: inner.trim(), fallback: undefined }
    : { name: inner.slice(0, comma).trim(), fallback: inner.slice(comma + 1) };
}

/**
 * What a custom property holds where a `var()` reads it. A declared value holds `var()`s of its own,
 * which substitution resolves in turn where the reading element is. A computed value was resolved
 * on the element that declared the property, as a child inherits it (CSS Custom Properties 1 §2),
 * so substitution takes it as it is. A computed value is undefined where a `var()` with no value and
 * no fallback left the property guaranteed-invalid (§3), and the reading `var()` takes its fallback.
 */
export type CustomValue =
  | { readonly value: string; readonly computed: false }
  | { readonly value: string | undefined; readonly computed: true };

/**
 * Replace every `var()` the resolver knows, and keep the synced variables. A `var()` the
 * resolver does not know falls back to its fallback, as CSS does for an unset property.
 *
 * @param value - A CSS value.
 * @param resolve - What a custom property holds, or undefined when nothing sets it.
 * @param keep - Whether a custom property stays a `var()` reference.
 * @param read - Collects each custom property the substitution read.
 * @returns The value with known variables substituted, or undefined when a `var()` has no
 *   value and no fallback.
 */
export function substituteVars(
  value: string,
  resolve: (customProperty: string) => CustomValue | undefined,
  keep: (customProperty: string) => boolean,
  read: Set<string>,
  depth = 0
): string | undefined {
  if (depth > 32) {
    throw new Error(`custom properties nest more than 32 deep in ${value}`);
  }
  let result = "";
  let index = 0;
  while (index < value.length) {
    const start = value.indexOf("var(", index);
    if (start === -1) {
      result += value.slice(index);
      break;
    }
    result += value.slice(index, start);
    const end = matchingParen(value, start + 3);
    const call = singleVar(value.slice(start, end + 1));
    if (call === undefined) {
      throw new Error(`a malformed var() in ${value}`);
    }
    index = end + 1;
    if (keep(call.name)) {
      result += `var(${call.name})`;
      continue;
    }
    const own = resolve(call.name);
    if (own !== undefined) {
      read.add(call.name);
    }
    if (own?.computed === true && own.value !== undefined) {
      result += own.value;
      continue;
    }
    const replacement = own?.value ?? call.fallback;
    if (replacement === undefined) {
      return undefined;
    }
    const substituted = substituteVars(replacement, resolve, keep, read, depth + 1);
    if (substituted === undefined) {
      return undefined;
    }
    result += substituted;
  }
  return result;
}

/**
 * Evaluate a length or number: `px`, `rem` at a 16px root, a unitless number, a percentage,
 * and `calc()`, `min()` and `max()` over them.
 *
 * @param value - A CSS value with no `var()` left in it.
 * @returns Pixels for a length, the number for a unitless value, a fraction for a
 *   percentage, or undefined for anything else.
 */
export function evaluateNumber(value: string): number | undefined {
  return finiteQuantity(value)?.value;
}

/**
 * Evaluate a percentage, such as the `calc(1 / 2 * 100%)` that `top-1/2` compiles to.
 *
 * @param value - A CSS value with no `var()` left in it.
 * @returns The fraction, 0.5 for 50%, or undefined for a value that is not a percentage.
 */
export function evaluatePercentage(value: string): number | undefined {
  const evaluated = finiteQuantity(value);
  return evaluated?.unit === "%" ? evaluated.value : undefined;
}

/**
 * Evaluate a length whose percentages take a known length, as a translate's percentage takes the
 * width of the box it moves (CSS Transforms 1).
 *
 * @param value - A CSS value with no `var()` left in it.
 * @param basis - The length in pixels that 100% stands for.
 * @returns The length in pixels, or undefined for anything that is not a finite length. A
 *   unitless number is a length only when it is 0.
 */
export function evaluateLengthOf(value: string, basis: number): number | undefined {
  const evaluated = finiteQuantity(value, basis);
  return evaluated?.unit === "px" || (evaluated?.unit === "" && evaluated.value === 0)
    ? evaluated.value
    : undefined;
}

/**
 * Whether a value is an infinite length, such as the `calc(infinity * 1px)` that `rounded-full`
 * compiles to. CSS clamps it to the largest length the property allows.
 *
 * @param value - A CSS value with no `var()` left in it.
 * @returns True for a length of positive infinity.
 */
export function isInfiniteLength(value: string): boolean {
  const evaluated = evaluate(normalizeCss(value));
  return evaluated?.value === Number.POSITIVE_INFINITY && evaluated.unit === "px";
}

/**
 * A number and its unit. The unit is `%` when an operand of the expression was a percentage,
 * since the result then depends on the containing block whatever the operand order, and `mixed`
 * when the expression also has a length, such as `calc(100% - 2px)`, whose value is then no
 * share of anything. Where the evaluation knows the length a percentage takes, the percentage is
 * that many pixels and the unit `px`.
 */
type Quantity = { readonly value: number; readonly unit: "px" | "" | "%" | "mixed" };

/**
 * Evaluate a value to a finite quantity.
 *
 * @param value - A CSS value with no `var()` left in it.
 * @param basis - The length in pixels a percentage stands for. Without it, a percentage stays a
 *   share of an unknown length.
 * @returns The quantity, or undefined for a value that does not evaluate or is infinite.
 */
function finiteQuantity(value: string, basis?: number): Quantity | undefined {
  const evaluated = evaluate(normalizeCss(value), basis);
  return evaluated !== undefined && Number.isFinite(evaluated.value) ? evaluated : undefined;
}

function evaluate(expression: string, basis?: number): Quantity | undefined {
  const trimmed = expression.trim();
  // `infinity` is a CSS math constant, a unitless number that only a `calc()` can hold.
  if (trimmed === "infinity" || trimmed === "-infinity") {
    return { value: trimmed === "infinity" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY, unit: "" };
  }
  const literal = /^([+-]?(?:\d+\.?\d*|\.\d+))(px|rem|%)?$/.exec(trimmed);
  if (literal !== null) {
    const number = Number(literal[1]);
    switch (literal[2]) {
      case "px":
        return { value: number, unit: "px" };
      case "rem":
        return { value: number * ROOT_FONT_SIZE_PX, unit: "px" };
      case "%":
        return basis === undefined
          ? { value: number / 100, unit: "%" }
          : { value: (number / 100) * basis, unit: "px" };
      default:
        return { value: number, unit: "" };
    }
  }
  const call = /^(calc|min|max)\(/.exec(trimmed);
  if (call !== null && matchingParen(trimmed, call[0].length - 1) === trimmed.length - 1) {
    const inner = trimmed.slice(call[0].length, -1);
    if (call[1] === "calc") {
      return evaluateSum(inner, basis);
    }
    const args = splitTopLevel(inner, ",").map((arg) => evaluateSum(arg, basis));
    if (args.some((arg) => arg === undefined) || args.length === 0) {
      return undefined;
    }
    const defined = args.filter((arg): arg is Quantity => arg !== undefined);
    const pick = call[1] === "min" ? Math.min : Math.max;
    return { value: pick(...defined.map((arg) => arg.value)), unit: commonUnit(defined) };
  }
  if (trimmed.startsWith("(") && matchingParen(trimmed, 0) === trimmed.length - 1) {
    return evaluateSum(trimmed.slice(1, -1), basis);
  }
  return undefined;
}

/**
 * Evaluate `a + b - c` over products. CSS requires spaces around `+` and `-`, so a space-
 * separated token that is `+` or `-` is an operator, and every other token joins a product.
 */
function evaluateSum(expression: string, basis?: number): Quantity | undefined {
  const products: string[][] = [[]];
  const operators: string[] = [];
  for (const token of splitTopLevel(expression, " ")) {
    if (token === "+" || token === "-") {
      operators.push(token);
      products.push([]);
    } else {
      products.at(-1)?.push(token);
    }
  }
  const [first, ...rest] = products.map((tokens) => evaluateProduct(tokens.join(""), basis));
  let total = first;
  for (const [index, next] of rest.entries()) {
    if (total === undefined || next === undefined) {
      return undefined;
    }
    total = {
      value: operators[index] === "+" ? total.value + next.value : total.value - next.value,
      unit: commonUnit([total, next]),
    };
  }
  return total;
}

/** Evaluate `a*b/c`, splitting at the `*` and `/` that sit outside parentheses. */
function evaluateProduct(term: string, basis?: number): Quantity | undefined {
  const factors: string[] = [];
  const operators: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < term.length; index += 1) {
    const char = term.charAt(index);
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    } else if ((char === "*" || char === "/") && depth === 0) {
      factors.push(term.slice(start, index));
      operators.push(char);
      start = index + 1;
    }
  }
  factors.push(term.slice(start));
  const [first, ...rest] = factors.map((factor) => evaluate(factor, basis));
  let product = first;
  for (const [index, next] of rest.entries()) {
    if (product === undefined || next === undefined) {
      return undefined;
    }
    product = {
      value: operators[index] === "*" ? product.value * next.value : product.value / next.value,
      unit: commonUnit([product, next]),
    };
  }
  return product;
}

/**
 * The unit of a result: `mixed` when the operands hold both a percentage and a length, `%` when
 * any operand depends on a percentage, else the first unit.
 */
function commonUnit(quantities: readonly Quantity[]): Quantity["unit"] {
  const units = new Set(quantities.map((quantity) => quantity.unit));
  if (units.has("mixed") || (units.has("%") && units.has("px"))) {
    return "mixed";
  }
  return units.has("%") ? "%" : (quantities.find((quantity) => quantity.unit !== "")?.unit ?? "");
}

/**
 * Read a length as a number field. A percentage is a share of the containing block, which a
 * Figma number field cannot hold, so it does not read, `calc()` over one included.
 *
 * @param value - A compiled value with Tailwind's variables already substituted.
 * @param index - The synced variables.
 * @returns The bound variable or the literal pixels, or undefined.
 */
export function readNumber(value: string, index: VariableIndex): NumberSpec | undefined {
  const variable = index.lookup(value) ?? flooredVariable(normalizeCss(value), index);
  if (variable !== undefined) {
    return { kind: "variable", variable };
  }
  const length = evaluateLength(value);
  return length === undefined ? undefined : { kind: "literal", value: length };
}

/**
 * What a number field read from CSS became, for the coverage table.
 *
 * @param spec - The number field, as {@link readNumber} read it.
 * @returns Bound with the variable's collection and name, or literal with the pixels.
 */
export function describeNumber(spec: NumberSpec): Pick<CoverageRow, "outcome" | "detail"> {
  return spec.kind === "variable"
    ? { outcome: "bound", detail: `${spec.variable.collection} / ${spec.variable.name}` }
    : { outcome: "literal", detail: `${spec.value}px` };
}

/**
 * What a box's `100%` stands for on one axis.
 *
 * - `parent`: the box sits in an auto layout whose length on the axis is definite, fixed or itself
 *   filling a definite length, so `100%` fills that length.
 * - `length`: a length in pixels, such as the preview width a variant root takes, or the parent an
 *   absolute box takes as its containing block. `of` names it for the coverage table, such as
 *   `the preview`, which the axis's length follows.
 * - `hugging`: the box sits in a flex box or a box that stacks blocks whose length on the axis hugs
 *   its content, so a percentage is cyclic, as CSS Sizing 3 calls it. Figma shrinks a layer that
 *   fills a hugging frame, so it does not read. Where nothing bounds the width CSS gives the parent,
 *   it is at least as wide as each layer it holds, so a `max-width` of `100%` or more never limits
 *   the box.
 * - `auto`: the box sits in a parent that stacks its layers down and hugs its height, so a percentage
 *   height computes to `auto` (CSS 2.1 §10.5) and any share hugs, as `percent-height.ts` says.
 * - `unset`: the box is an in-flow variant root alone in its component set with no preview width, so
 *   its container gives it no width, and it is a block-level box with no margins, padding or border,
 *   whose unset width and `100%` are the same width (CSS 2.1 §10.3.3). The kit draws that unset
 *   width hugging, so `100%` hugs too. An absolute root's `100%` takes its containing block, while
 *   its unset width shrinks to fit (§10.3.7), so it takes `none`.
 * - `none`: no length the build knows, as for a root with no preview width of any other kind, or
 *   an absolute box whose containing block lies above its parent.
 */
export type PercentBasis =
  | { readonly kind: "parent" }
  | { readonly kind: "length"; readonly value: number; readonly of: string }
  | { readonly kind: "hugging" }
  | { readonly kind: "auto" }
  | { readonly kind: "unset" }
  | { readonly kind: "none" };

/**
 * Read a `width` or `height` as the sizing of its axis. A length is fixed. `fit-content` is the size
 * of what the box holds where its container has room to spare, which a kit frame's default content
 * has, so it hugs, unless `readLength` in `box-sizing.ts` fills a text box's room. `max-content` is
 * the size of what the box holds laid out on one line whatever room it has (CSS Sizing 3 §5.1), which
 * a frame that hugs a hugging text draws, so it hugs. A percentage takes
 * the basis: against a length in pixels any share is that share of it, against a parent's auto
 * layout only the whole fills, since a fill takes no share, where the whole is the box's unset
 * width only the whole hugs, as that width does, and where it computes to `auto` any share hugs. Any
 * other percentage stays unread, as {@link readNumber} leaves it.
 *
 * @param value - A compiled value with Tailwind's variables already substituted.
 * @param index - The synced variables.
 * @param basis - What `100%` stands for on the axis.
 * @returns The sizing, or undefined for a value no sizing holds.
 */
export function readSize(value: string, index: VariableIndex, basis: PercentBasis): SizeSpec | undefined {
  if (["fit-content", "max-content"].includes(normalizeCss(value))) {
    return { kind: "hug" };
  }
  const length = readNumber(value, index);
  if (length !== undefined) {
    return { kind: "fixed", length };
  }
  const share = evaluatePercentage(value);
  if (share === undefined) {
    return undefined;
  }
  switch (basis.kind) {
    case "parent":
      return share === 1 ? { kind: "fill" } : undefined;
    case "length":
      return { kind: "fixed", length: { kind: "literal", value: share * basis.value } };
    case "unset":
      return share === 1 ? { kind: "hug" } : undefined;
    case "auto":
      return { kind: "hug" };
    case "hugging":
    case "none":
      return undefined;
  }
}

/**
 * A length that is a constant plus each variable it reads times a coefficient, in pixels, as the
 * sums, differences and scalings `calc()` writes over synced variables give it. Two such lengths
 * are the same wherever the variables take a value exactly when their constants and coefficients
 * match, which {@link sameAffine} checks.
 */
export type AffineLength = {
  readonly constant: number;
  /** Each variable's coefficient, by its custom property, such as `--row-px`. */
  readonly coefficients: ReadonlyMap<string, number>;
};

/** An affine quantity: a length in pixels, or a plain number, which scales a length. */
type Affine = AffineLength & { readonly unit: "px" | "" };

/** How far apart two coefficients may be and still count as one. */
const SAME_COEFFICIENT = 1e-9;

/**
 * Read a length as an affine expression of the variables it reads. Every `var()` left in the value
 * is a synced variable, a length. A product or quotient that scales a variable by a number, and a
 * `min()` or `max()` over no variable, stay affine. Anything else, a product of two variables, a
 * `min()` or `max()` over one, a percentage or a division by a length, is no affine length.
 *
 * @param value - A CSS value whose `var()`s are synced variables or none.
 * @returns The length, or undefined where the value is no affine length.
 */
export function affineLength(value: string): AffineLength | undefined {
  const read = affine(value);
  return read !== undefined && (read.unit === "px" || isZero(read)) ? read : undefined;
}

/**
 * Add affine lengths.
 *
 * @param lengths - The lengths.
 * @returns Their sum.
 */
export function sumAffine(lengths: readonly AffineLength[]): AffineLength {
  return lengths.reduce<AffineLength>((sum, length) => combine(sum, length, 1), {
    constant: 0,
    coefficients: new Map(),
  });
}

/**
 * Whether two affine lengths are the same wherever their variables take a value.
 *
 * @param left - A length.
 * @param right - Another length.
 * @returns True when their constants and every variable's coefficient match.
 */
export function sameAffine(left: AffineLength, right: AffineLength): boolean {
  return isZero(combine(left, right, -1));
}

/** Whether an affine quantity is zero wherever its variables take a value. */
function isZero({ constant, coefficients }: AffineLength): boolean {
  return (
    Math.abs(constant) < SAME_COEFFICIENT &&
    [...coefficients.values()].every((coefficient) => Math.abs(coefficient) < SAME_COEFFICIENT)
  );
}

/** `left + sign * right`, keeping the left's unit. */
function combine<Length extends AffineLength>(left: Length, right: AffineLength, sign: 1 | -1): Length {
  const coefficients = new Map(left.coefficients);
  for (const [name, coefficient] of right.coefficients) {
    coefficients.set(name, (coefficients.get(name) ?? 0) + sign * coefficient);
  }
  return { ...left, constant: left.constant + sign * right.constant, coefficients };
}

/** Multiply an affine quantity by a number. */
function scale(quantity: Affine, factor: number): Affine {
  return {
    unit: quantity.unit,
    constant: quantity.constant * factor,
    coefficients: new Map(
      [...quantity.coefficients].map(([name, coefficient]) => [name, coefficient * factor])
    ),
  };
}

/** Read one operand, a literal, a `var()`, a call or a parenthesised sum, as {@link evaluate} does. */
function affine(expression: string): Affine | undefined {
  const trimmed = expression.trim();
  const literal = /^([+-]?(?:\d+\.?\d*|\.\d+))(px|rem)?$/.exec(trimmed);
  if (literal !== null) {
    const number = Number(literal[1]);
    return literal[2] === undefined
      ? { unit: "", constant: number, coefficients: new Map() }
      : {
          unit: "px",
          constant: literal[2] === "rem" ? number * ROOT_FONT_SIZE_PX : number,
          coefficients: new Map(),
        };
  }
  const variable = singleVar(trimmed);
  if (variable !== undefined) {
    return { unit: "px", constant: 0, coefficients: new Map([[variable.name, 1]]) };
  }
  const call = /^(calc|min|max)\(/.exec(trimmed);
  if (call !== null && matchingParen(trimmed, call[0].length - 1) === trimmed.length - 1) {
    const inner = trimmed.slice(call[0].length, -1);
    if (call[1] === "calc") {
      return affineSum(inner);
    }
    // Over no variable, `min()` and `max()` pick a constant. Over one they pick per value.
    const args = splitTopLevel(inner, ",").map(affineSum);
    const constants = args.filter((arg): arg is Affine => arg?.coefficients.size === 0);
    if (constants.length === 0 || constants.length !== args.length) {
      return undefined;
    }
    const pick = call[1] === "min" ? Math.min : Math.max;
    const [first] = constants;
    return first === undefined
      ? undefined
      : {
          unit: first.unit,
          constant: pick(...constants.map((arg) => arg.constant)),
          coefficients: new Map(),
        };
  }
  if (trimmed.startsWith("(") && matchingParen(trimmed, 0) === trimmed.length - 1) {
    return affineSum(trimmed.slice(1, -1));
  }
  return undefined;
}

/** Read `a + b - c` over products, whose operands share a unit, as {@link evaluateSum} splits it. */
function affineSum(expression: string): Affine | undefined {
  const products: string[][] = [[]];
  const operators: string[] = [];
  for (const token of splitTopLevel(expression, " ")) {
    if (token === "+" || token === "-") {
      operators.push(token);
      products.push([]);
    } else {
      products.at(-1)?.push(token);
    }
  }
  const [first, ...rest] = products.map((tokens) => affineProduct(tokens.join("")));
  let total = first;
  for (const [index, next] of rest.entries()) {
    if (total === undefined || next === undefined || total.unit !== next.unit) {
      return undefined;
    }
    total = combine(total, next, operators[index] === "+" ? 1 : -1);
  }
  return total;
}

/**
 * Read `a*b/c`, as {@link evaluateProduct} splits it. A product stays affine where at most one
 * factor reads a variable and at most one is a length, and a quotient where its divisor is a
 * nonzero number.
 */
function affineProduct(term: string): Affine | undefined {
  const factors: string[] = [];
  const operators: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < term.length; index += 1) {
    const char = term.charAt(index);
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    } else if ((char === "*" || char === "/") && depth === 0) {
      factors.push(term.slice(start, index));
      operators.push(char);
      start = index + 1;
    }
  }
  factors.push(term.slice(start));
  const [first, ...rest] = factors.map(affine);
  let product = first;
  for (const [index, next] of rest.entries()) {
    if (product === undefined || next === undefined) {
      return undefined;
    }
    if (operators[index] === "/") {
      if (next.unit !== "" || next.coefficients.size > 0 || next.constant === 0) {
        return undefined;
      }
      product = scale(product, 1 / next.constant);
      continue;
    }
    const [number, quantity] =
      next.unit === "" && next.coefficients.size === 0 ? [next, product] : [product, next];
    if (number.unit !== "" || number.coefficients.size > 0) {
      return undefined;
    }
    product = scale(quantity, number.constant);
  }
  return product;
}

/**
 * Evaluate a length or number in pixels.
 *
 * @param value - A CSS value with no `var()` left in it.
 * @returns The pixels, or undefined for anything that depends on a percentage or is infinite.
 */
export function evaluateLength(value: string): number | undefined {
  const evaluated = finiteQuantity(value);
  return evaluated === undefined || evaluated.unit === "%" || evaluated.unit === "mixed"
    ? undefined
    : evaluated.value;
}

/**
 * The variable in a `max()` of a synced variable and a length that variable never falls below
 * in any mode. The 24px target floor on `--control-h-xs` is one: the variable holds 24px or
 * more at every density, so the floor never applies and the value binds the variable.
 */
function flooredVariable(value: string, index: VariableIndex): VariableRef | undefined {
  if (!value.startsWith("max(") || matchingParen(value, 3) !== value.length - 1) {
    return undefined;
  }
  const [first, second, ...rest] = splitTopLevel(value.slice(4, -1), ",");
  if (first === undefined || second === undefined || rest.length > 0) {
    return undefined;
  }
  for (const [candidate, floor] of [
    [first, second],
    [second, first],
  ] as const) {
    const variable = index.lookup(candidate);
    const minimum = variable === undefined ? undefined : index.minimum(variable);
    const length = evaluateLength(floor);
    if (variable !== undefined && minimum !== undefined && length !== undefined && minimum >= length) {
      return variable;
    }
  }
  return undefined;
}

/**
 * `color-mix()` toward `transparent`, as Tailwind compiles an opacity modifier such as
 * `outline-black/10`: the space, the color and its share.
 */
const TOWARD_TRANSPARENT = /^color-mix\(in [a-z-]+, ?(.+) (\d+(?:\.\d+)?)%, ?transparent\)$/;

/**
 * Read a color as a paint. A synced variable binds, including a role tint whose code syntax is
 * the `color-mix()` toward `transparent` that `bg-error/10` compiles to, and a color literal
 * becomes sRGB. A literal mixed toward `transparent` keeps its channels at that share of its alpha,
 * since a mix interpolates premultiplied colors (CSS Color 5 §2.4), as `outline-black/10` paints
 * black at 10%. A share outside 0% to 100% is no color in CSS's grammar, so it stays unmapped. A
 * variable mix the sync has no tint for stays unmapped, because a Figma paint takes its opacity
 * from the variable it binds.
 *
 * `@elmeragroup/color` parses the color and builds the mixed one. It has no `color-mix()` parser,
 * no mix toward `transparent` in sRGB, and no shorthand hex, so this reader matches the mix's form,
 * checks its share, scales the alpha, and spells a shorthand out.
 *
 * @param value - A compiled value with Tailwind's variables already substituted.
 * @param index - The synced variables.
 * @returns The paint, or undefined for a color the reader cannot express.
 */
export function readColor(value: string, index: VariableIndex): ColorSpec | undefined {
  const normalized = normalizeCss(value);
  const variable = index.lookup(normalized);
  if (variable !== undefined) {
    return { kind: "variable", variable };
  }
  if (normalized === "transparent") {
    return { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0 } };
  }
  const mix = TOWARD_TRANSPARENT.exec(normalized);
  const share = mix === null ? 1 : Number(mix[2]) / 100;
  const srgb = parseLiteral(mix === null ? normalized : (mix[1] ?? ""));
  if (srgb === undefined || share < 0 || share > 1) {
    return undefined;
  }
  const mixed = Srgb.make({ r: srgb.r, g: srgb.g, b: srgb.b, alpha: srgb.alpha * share });
  return mixed._tag === "err"
    ? undefined
    : {
        kind: "literal",
        color: { r: mixed.value.r, g: mixed.value.g, b: mixed.value.b, a: mixed.value.alpha },
      };
}

/**
 * Parse a color literal through `@elmeragroup/color` as sRGB. Tailwind's theme writes black and
 * white as the shorthand `#000` and `#fff`, which the shared parser refuses, so the reader spells a
 * shorthand out to the six digits it takes.
 *
 * @returns The color, or undefined for a value that is no color literal the parser reads.
 */
function parseLiteral(value: string): Srgb.Srgb | undefined {
  const shorthand = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  const parsed = CssColor.parse(
    shorthand === null
      ? value
      : `#${shorthand
          .slice(1)
          .map((digit) => digit.repeat(2))
          .join("")}`
  );
  return parsed._tag === "err" ? undefined : CssColor.toSrgb(parsed.value);
}

/**
 * Read a `box-shadow` list as drop shadows. A layer with zero offsets, blur and spread is
 * Tailwind's empty placeholder and drops out. The blur and spread bind a synced variable whose
 * code syntax they spell, such as the outline Button's `max()` over its outline width.
 *
 * @param value - A compiled value with Tailwind's variables already substituted.
 * @param index - The synced variables.
 * @returns The shadows, or undefined when a layer is an inset shadow or does not parse.
 */
export function readShadows(value: string, index: VariableIndex): readonly ShadowSpec[] | undefined {
  const shadows: ShadowSpec[] = [];
  for (const layer of splitTopLevel(normalizeCss(value), ",")) {
    const tokens = splitTopLevel(layer, " ");
    if (tokens.includes("inset")) {
      return undefined;
    }
    const [x, y, blur = "0", spreadBy = "0", ...extra] = tokens.slice(0, -1);
    const offsetX = x === undefined ? undefined : evaluateNumber(x);
    const offsetY = y === undefined ? undefined : evaluateNumber(y);
    const radius = readNumber(blur, index);
    const spread = readNumber(spreadBy, index);
    if (
      offsetX === undefined ||
      offsetY === undefined ||
      radius === undefined ||
      spread === undefined ||
      extra.length > 0
    ) {
      return undefined;
    }
    // Tailwind fills unused layers with `0 0 #0000`, which paints nothing whatever its color.
    if ([offsetX, offsetY, literalOf(radius), literalOf(spread)].every((length) => length === 0)) {
      continue;
    }
    const color = readColor(tokens.at(-1) ?? "", index);
    if (color === undefined) {
      return undefined;
    }
    shadows.push({ color, offsetX, offsetY, radius, spread });
  }
  return shadows;
}

/** A literal's pixels, or undefined for a bound length. */
function literalOf(spec: NumberSpec): number | undefined {
  return spec.kind === "literal" ? spec.value : undefined;
}

/**
 * Split at a separator that sits outside parentheses, dropping empty parts, so a `calc()` with
 * spaces stays one part.
 *
 * @param value - A CSS value.
 * @param separator - The one character to split at, such as a space or a comma.
 * @returns The trimmed parts.
 */
export function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charAt(index);
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    } else if (char === separator && depth === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

function topLevelIndex(value: string, needle: string): number {
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charAt(index);
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    } else if (char === needle && depth === 0) {
      return index;
    }
  }
  return -1;
}

/** The index of the parenthesis that closes the one at `open`. */
function matchingParen(value: string, open: number): number {
  let depth = 0;
  for (let index = open; index < value.length; index += 1) {
    const char = value.charAt(index);
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  throw new Error(`an unclosed parenthesis in ${value}`);
}
