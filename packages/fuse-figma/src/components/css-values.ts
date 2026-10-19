/**
 * Read compiled CSS values as Figma fields. A value that is exactly a synced variable's web
 * code syntax binds that variable. Any other value must reduce to a number or a color once
 * Tailwind's own variables are substituted, or it stays unmapped.
 */
import * as CssColor from "@elmeragroup/color/css-color";

import type { ColorSpec, NumberSpec, ShadowSpec, VariableRef } from "./kit-spec";

/** The root font size the catalog assumes when it turns `rem` into pixels. */
const ROOT_FONT_SIZE_PX = 16;

/**
 * Finds the synced variable whose web code syntax a CSS value spells. The sync writes
 * `var(--primary)` for a token and the rung's `calc()` for a radius rung.
 */
export type VariableIndex = {
  readonly lookup: (value: string) => VariableRef | undefined;
  /** Whether a custom property is a synced variable, which substitution must keep. */
  readonly owns: (customProperty: string) => boolean;
};

/**
 * Index synced variables by their web code syntax.
 *
 * @param variables - Each synced variable with the code syntax the sync writes for it.
 * @returns The index.
 */
export function makeVariableIndex(
  variables: readonly { readonly ref: VariableRef; readonly webSyntax: string }[]
): VariableIndex {
  const bySyntax = new Map<string, VariableRef>();
  const owned = new Set<string>();
  for (const { ref, webSyntax } of variables) {
    bySyntax.set(normalizeCss(webSyntax), ref);
    const single = singleVar(webSyntax);
    if (single !== undefined) {
      owned.add(single.name);
    }
  }
  return {
    lookup: (value) => {
      const normalized = normalizeCss(value);
      const single = singleVar(normalized);
      return bySyntax.get(single === undefined ? normalized : `var(${single.name})`);
    },
    owns: (customProperty) => owned.has(customProperty),
  };
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
 * Replace every `var()` the resolver knows, and keep the synced variables. A `var()` the
 * resolver does not know falls back to its fallback, as CSS does for an unset property.
 *
 * @param value - A CSS value.
 * @param resolve - The value of a custom property, or undefined when nothing sets it.
 * @param keep - Whether a custom property stays a `var()` reference.
 * @param read - Collects each custom property the substitution read.
 * @returns The value with known variables substituted, or undefined when a `var()` has no
 *   value and no fallback.
 */
export function substituteVars(
  value: string,
  resolve: (customProperty: string) => string | undefined,
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
    const replacement = own ?? call.fallback;
    if (own !== undefined) {
      read.add(call.name);
    }
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
  const evaluated = evaluate(normalizeCss(value));
  return evaluated?.value;
}

type Quantity = { readonly value: number; readonly unit: "px" | "" | "%" };

function evaluate(expression: string): Quantity | undefined {
  const trimmed = expression.trim();
  const literal = /^([+-]?(?:\d+\.?\d*|\.\d+))(px|rem|%)?$/.exec(trimmed);
  if (literal !== null) {
    const number = Number(literal[1]);
    switch (literal[2]) {
      case "px":
        return { value: number, unit: "px" };
      case "rem":
        return { value: number * ROOT_FONT_SIZE_PX, unit: "px" };
      case "%":
        return { value: number / 100, unit: "%" };
      default:
        return { value: number, unit: "" };
    }
  }
  const call = /^(calc|min|max)\(/.exec(trimmed);
  if (call !== null && matchingParen(trimmed, call[0].length - 1) === trimmed.length - 1) {
    const inner = trimmed.slice(call[0].length, -1);
    if (call[1] === "calc") {
      return evaluateSum(inner);
    }
    const args = splitTopLevel(inner, ",").map(evaluateSum);
    if (args.some((arg) => arg === undefined) || args.length === 0) {
      return undefined;
    }
    const defined = args.filter((arg): arg is Quantity => arg !== undefined);
    const pick = call[1] === "min" ? Math.min : Math.max;
    return { value: pick(...defined.map((arg) => arg.value)), unit: commonUnit(defined) };
  }
  if (trimmed.startsWith("(") && matchingParen(trimmed, 0) === trimmed.length - 1) {
    return evaluateSum(trimmed.slice(1, -1));
  }
  return undefined;
}

/**
 * Evaluate `a + b - c` over products. CSS requires spaces around `+` and `-`, so a space-
 * separated token that is `+` or `-` is an operator, and every other token joins a product.
 */
function evaluateSum(expression: string): Quantity | undefined {
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
  const [first, ...rest] = products.map((tokens) => evaluateProduct(tokens.join("")));
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
function evaluateProduct(term: string): Quantity | undefined {
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
  const [first, ...rest] = factors.map(evaluate);
  let product = first;
  for (const [index, next] of rest.entries()) {
    if (product === undefined || next === undefined) {
      return undefined;
    }
    product =
      operators[index] === "*"
        ? { value: product.value * next.value, unit: product.unit === "" ? next.unit : product.unit }
        : { value: product.value / next.value, unit: product.unit };
  }
  return product;
}

function commonUnit(quantities: readonly Quantity[]): Quantity["unit"] {
  return quantities.find((quantity) => quantity.unit !== "")?.unit ?? "";
}

/**
 * Read a length as a number field.
 *
 * @param value - A compiled value with Tailwind's variables already substituted.
 * @param index - The synced variables.
 * @returns The bound variable or the literal pixels, or undefined.
 */
export function readNumber(value: string, index: VariableIndex): NumberSpec | undefined {
  const variable = index.lookup(value);
  if (variable !== undefined) {
    return { kind: "variable", variable };
  }
  const number = evaluateNumber(value);
  return number === undefined ? undefined : { kind: "literal", value: number };
}

/**
 * Read a color as a paint. A synced variable binds, `color-mix()` toward `transparent`
 * binds the variable at the mixed opacity, and a color literal becomes sRGB.
 *
 * @param value - A compiled value with Tailwind's variables already substituted.
 * @param index - The synced variables.
 * @returns The paint, or undefined for a color the reader cannot express.
 */
export function readColor(value: string, index: VariableIndex): ColorSpec | undefined {
  const normalized = normalizeCss(value);
  const variable = index.lookup(normalized);
  if (variable !== undefined) {
    return { kind: "variable", variable, opacity: 1 };
  }
  const mix = /^color-mix\(in oklab,(.+) (\d+(?:\.\d+)?)%,transparent\)$/.exec(normalized);
  if (mix !== null) {
    const mixed = index.lookup(mix[1] ?? "");
    return mixed === undefined
      ? undefined
      : { kind: "variable", variable: mixed, opacity: Number(mix[2]) / 100 };
  }
  if (normalized === "transparent") {
    return { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0 } };
  }
  const parsed = CssColor.parse(normalized);
  if (parsed._tag === "err") {
    return undefined;
  }
  const srgb = CssColor.toSrgb(parsed.value);
  return { kind: "literal", color: { r: srgb.r, g: srgb.g, b: srgb.b, a: srgb.alpha } };
}

/**
 * Read a `box-shadow` list as drop shadows. A layer with zero offsets, blur and spread is
 * Tailwind's empty placeholder and drops out.
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
    const lengths = tokens.slice(0, -1).map(evaluateNumber);
    if (lengths.length < 2 || lengths.length > 4 || lengths.some((length) => length === undefined)) {
      return undefined;
    }
    const [offsetX = 0, offsetY = 0, radius = 0, spread = 0] = lengths.filter(
      (length): length is number => length !== undefined
    );
    // Tailwind fills unused layers with `0 0 #0000`, which paints nothing whatever its color.
    if (offsetX === 0 && offsetY === 0 && radius === 0 && spread === 0) {
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

/** Split at a separator that sits outside parentheses, dropping empty parts. */
function splitTopLevel(value: string, separator: string): string[] {
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
