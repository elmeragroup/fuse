/**
 * Tailwind class parsing for the source contracts in `src/source-contracts.test.ts`: the class
 * tokens a module's code holds, a token's variants and utility, and the color roles a module's
 * classes paint, each with the paint its utility draws.
 */

import { isColorTokenName, TOKEN_NAMES } from "../src/theme/tokens/contract";
import type { ColorTokenName, TokenPaint } from "../src/theme/tokens/contract";

/**
 * The class tokens in source code: every run between whitespace, quotes and backticks.
 *
 * @param code - A module's code.
 * @returns The runs in source order.
 */
export function classTokens(code: string): string[] {
  return code.split(/[\s"'`]+/u).filter((token) => token.length > 0);
}

/** A class token split at the colons outside brackets. */
export type SplitToken = {
  /** The variants before the utility, such as `hover` and `data-open`. */
  readonly variants: readonly string[];

  /** The utility after the last variant. */
  readonly utility: string;
};

/** The change a character makes to the bracket and parenthesis depth of a class token. */
function depthStep(character: string): number {
  if (character === "[" || character === "(") return 1;
  if (character === "]" || character === ")") return -1;
  return 0;
}

/**
 * Split a class token into its variants and utility at the colons outside brackets and
 * parentheses, so the type hint in `text-(color:--x)` stays in the utility.
 *
 * @param token - One class token.
 * @returns Its variants and utility.
 */
export function splitVariants(token: string): SplitToken {
  const variants: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of token) {
    depth += depthStep(character);
    if (character === ":" && depth === 0) {
      variants.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  return { variants, utility: current };
}

/**
 * The paint each Tailwind color utility draws. The families are every utility Tailwind 4.3
 * resolves against the `--color-*` theme namespace (`dist/lib.js`), less the effects and masks
 * that {@link colorRolePaints} lists as limits. A fill is a surface: a background, a gradient
 * stop, an SVG `fill-*` shape, a native control's `accent-*` and a scrollbar's thumb and track.
 * The text color and its placeholder, caret and decoration are ink. Borders on every side,
 * rings, outlines, dividers and SVG strokes are lines.
 */
const UTILITY_PAINTS = {
  bg: "surface",
  from: "surface",
  via: "surface",
  to: "surface",
  fill: "surface",
  accent: "surface",
  "scrollbar-thumb": "surface",
  "scrollbar-track": "surface",
  text: "ink",
  placeholder: "ink",
  caret: "ink",
  decoration: "ink",
  border: "line",
  "border-x": "line",
  "border-y": "line",
  "border-t": "line",
  "border-b": "line",
  "border-l": "line",
  "border-r": "line",
  "border-s": "line",
  "border-e": "line",
  "border-bs": "line",
  "border-be": "line",
  ring: "line",
  "inset-ring": "line",
  "ring-offset": "line",
  outline: "line",
  divide: "line",
  stroke: "line",
} as const satisfies Record<string, TokenPaint>;

type ColorUtility = keyof typeof UTILITY_PAINTS;

/** The utility prefixes, longest first, so `ring-offset-error` is not read as `ring-` and `offset-error`. */
const COLOR_UTILITIES = Object.keys(UTILITY_PAINTS)
  .filter((key): key is ColorUtility => Object.hasOwn(UTILITY_PAINTS, key))
  .toSorted((a, b) => b.length - a.length);

/** One color role a class paints, the paint its utility draws, and the class. */
export type RolePaint = {
  readonly role: ColorTokenName;
  readonly paint: TokenPaint;
  readonly token: string;
};

function colorRole(name: string): ColorTokenName | undefined {
  const role = TOKEN_NAMES.find((candidate) => candidate === name);
  return role !== undefined && isColorTokenName(role) ? role : undefined;
}

/** The custom properties a CSS value reads through `var(--x)` or `--theme(--color-x)`. */
function propertiesRead(value: string): string[] {
  return [...value.matchAll(/(?:var\(--|--theme\(--color-)([a-z0-9-]+)/gu)].map((match) => match[1] ?? "");
}

/** A utility with its `!` important marker removed. */
function bareUtility(token: string): string {
  return splitVariants(token).utility.replace(/^!|!$/gu, "");
}

/**
 * The local routing variables a module's classes assign, such as `[--checkbox-color:var(--muted)]`,
 * each with the color roles any of its assignments in the module reads.
 */
function routes(tokens: readonly string[]): ReadonlyMap<string, ReadonlySet<ColorTokenName>> {
  const routed = new Map<string, Set<ColorTokenName>>();
  for (const token of tokens) {
    const assignment = /^\[--([a-z0-9-]+):(.+)\]$/u.exec(bareUtility(token));
    if (assignment === null) continue;
    const [, name = "", value = ""] = assignment;
    for (const role of propertiesRead(value).flatMap((read) => colorRole(read) ?? [])) {
      const roles = routed.get(name) ?? new Set<ColorTokenName>();
      roles.add(role);
      routed.set(name, roles);
    }
  }
  return routed;
}

/** A utility value without its opacity modifier: the text before the first `/` at depth 0. */
function withoutModifier(value: string): string {
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value.charAt(index);
    depth += depthStep(character);
    if (character === "/" && depth === 0) return value.slice(0, index);
  }
  return value;
}

/**
 * The custom properties a utility value reads as a color. A bracketed value reads every
 * `var(--x)` and `--theme(--color-x)` in it, a parenthesized one its `--x`, and a bare one names
 * a theme color. A type hint other than `color`, such as `text-(length:--label-text)`, reads no
 * color.
 */
function colorReads(value: string): string[] {
  const enclosed = /^([[(])(?:([a-z-]+):)?(.*)[\])]$/u.exec(value);
  if (enclosed === null) return [value];
  const [, open, hint, inner = ""] = enclosed;
  if (hint !== undefined && hint !== "color") return [];
  if (open === "[") return propertiesRead(inner);
  const property = /^--([a-z0-9-]+)$/u.exec(inner)?.[1];
  return property === undefined ? [] : [property];
}

/** The paint a token's color utility draws and the custom properties it reads, or nothing. */
function utilityReads(
  token: string
): { readonly paint: TokenPaint; readonly reads: readonly string[] } | undefined {
  const utility = bareUtility(token);
  const prefix = COLOR_UTILITIES.find((candidate) => utility.startsWith(`${candidate}-`));
  if (prefix === undefined) return undefined;
  return {
    paint: UTILITY_PAINTS[prefix],
    reads: colorReads(withoutModifier(utility.slice(prefix.length + 1))),
  };
}

/**
 * The color roles a module's classes paint. A class paints a role when its color utility reads
 * the role: a named utility such as `hover:bg-primary/50`, the `text-(--muted-foreground)/50`
 * shorthand with or without a `color:` hint, or a `var(--role)` or `--theme(--color-role)` in an
 * arbitrary value. It also paints
 * every role the module routes through a local variable it reads: GridList's checkbox assigns
 * `[--checkbox-color:var(--muted)]` and draws `border-(--checkbox-color)`, so it paints `muted`
 * as a line. A route counts for every read in the same module, which can over-attribute a role
 * to a read on another element but never misses one.
 *
 * The scan cannot see a route that crosses modules, such as a component that assigns `--ring`
 * for the shared focus-ring utility in `styles/utils.ts` or `fuse.css` to read, a route through a
 * second variable, a variable set from an inline `style` prop or a CSS file, or a class built at
 * runtime. An object key spelled like a utility, such as Badge's `outline-destructive` variant,
 * reads as one. A class that sets a custom property paints nothing here. Tailwind's effect colors,
 * `shadow-*`, `inset-shadow-*`, `drop-shadow-*` and `text-shadow-*`, are outside the scan,
 * because no paint names an effect, so a role drawn only in a shadow, as a Sidebar outline button
 * draws `sidebar-accent` in a 1px shadow ring, needs its paint by hand. The `mask-*-from` and
 * `mask-*-to` stops set alpha, not a color anyone sees.
 *
 * @param code - A module's code, comments removed.
 * @returns Every role a class paints, with the paint and the class, in source order.
 */
export function colorRolePaints(code: string): RolePaint[] {
  const tokens = classTokens(code);
  const routed = routes(tokens);
  return tokens.flatMap((token) => {
    const read = utilityReads(token);
    if (read === undefined) return [];
    return read.reads.flatMap((name) => {
      const direct = colorRole(name);
      const roles = [...(direct === undefined ? [] : [direct]), ...(routed.get(name) ?? [])];
      return roles.map((role) => ({ role, paint: read.paint, token }));
    });
  });
}
