/**
 * Tailwind class parsing for the source contracts in `src/source-contracts.test.ts`: the class
 * tokens a module's code holds, a token's variants and utility, the color roles a module's classes
 * paint, each with the paint its utility draws, and the classes that route a role into a contract
 * color token's own property.
 */

import { isColorTokenName } from "../src/theme/tokens/contract";
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

/** A class token's parts between each `separator` outside brackets and parentheses. */
function splitTopLevel(token: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of token) {
    depth += depthStep(character);
    if (character === separator && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  return [...parts, current];
}

/**
 * Split a class token into its variants and utility at the colons outside brackets and
 * parentheses, so the type hint in `text-(color:--x)` stays in the utility.
 *
 * @param token - One class token.
 * @returns Its variants and utility.
 */
export function splitVariants(token: string): SplitToken {
  const parts = splitTopLevel(token, ":");
  return { variants: parts.slice(0, -1), utility: parts.at(-1) ?? "" };
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

/**
 * The utility prefixes with their paints, longest first, so `ring-offset-error` is not read as
 * `ring-` and `offset-error`.
 */
const COLOR_UTILITIES = Object.entries(UTILITY_PAINTS).toSorted(([a], [b]) => b.length - a.length);

/** One color role a class paints, the paint its utility draws, and the class. */
export type RolePaint = {
  readonly role: ColorTokenName;
  readonly paint: TokenPaint;
  readonly token: string;
};

/** The custom properties a CSS value reads through `var(--x)` or `--theme(--color-x)`. */
function propertiesRead(value: string): string[] {
  return [...value.matchAll(/(?:var\(--|--theme\(--color-)([a-z0-9-]+)/gu)].map((match) => match[1] ?? "");
}

/** A utility with its `!` important marker removed. */
function bareUtility(token: string): string {
  return splitVariants(token).utility.replace(/^!|!$/gu, "");
}

/** A class that assigns a custom property, the property, and the color roles its value reads. */
type Assignment = {
  readonly name: string;
  readonly roles: readonly ColorTokenName[];
  readonly token: string;
};

/** The classes among `tokens` that assign a custom property, such as `[--checkbox-color:var(--muted)]`. */
function assignments(tokens: readonly string[]): Assignment[] {
  return tokens.flatMap((token) => {
    const assignment = /^\[--([a-z0-9-]+):(.+)\]$/u.exec(bareUtility(token));
    if (assignment === null) return [];
    const [, name = "", value = ""] = assignment;
    return [{ name, roles: propertiesRead(value).filter(isColorTokenName), token }];
  });
}

/**
 * The local routing variables a module's classes assign, such as `[--checkbox-color:var(--muted)]`,
 * each with the color roles any of its assignments in the module reads.
 */
function routes(tokens: readonly string[]): ReadonlyMap<string, ReadonlySet<ColorTokenName>> {
  const routed = new Map<string, Set<ColorTokenName>>();
  for (const { name, roles } of assignments(tokens)) {
    routed.set(name, new Set([...(routed.get(name) ?? []), ...roles]));
  }
  return routed;
}

/** A utility value without its opacity modifier: the text before the first `/` at depth 0. */
function withoutModifier(value: string): string {
  return splitTopLevel(value, "/")[0] ?? value;
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
  const match = COLOR_UTILITIES.find(([prefix]) => utility.startsWith(`${prefix}-`));
  if (match === undefined) return undefined;
  const [prefix, paint] = match;
  return { paint, reads: colorReads(withoutModifier(utility.slice(prefix.length + 1))) };
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
 * A route that crosses modules through a contract color token's own property, such as Toast's
 * `[--ring:var(--info-soft-foreground)]` for the shared focus ring in `styles/utils.ts`, is left
 * out here: {@link tokenAssignments} returns it, and the "token paints" source contract checks it.
 * The scan cannot see any other route that crosses modules, a route through a second variable, a
 * variable set from an inline `style` prop or a CSS file, or a class built at runtime. An object
 * key spelled like a utility, such as Badge's `outline-destructive` variant, reads as one. A class
 * that sets a custom property paints nothing here. Tailwind's effect colors, `shadow-*`,
 * `inset-shadow-*`, `drop-shadow-*` and `text-shadow-*`, are outside the scan, because no paint
 * names an effect, so a role drawn only in a shadow, as a Sidebar outline button draws
 * `sidebar-accent` in a 1px shadow ring, needs its paint by hand. The `mask-*-from` and
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
      const roles = [...(isColorTokenName(name) ? [name] : []), ...(routed.get(name) ?? [])];
      return roles.map((role) => ({ role, paint: read.paint, token }));
    });
  });
}

/** A class that assigns a contract color token's own custom property, and a role its value reads. */
export type TokenAssignment = {
  /** The color token whose property the class assigns, such as `ring`. */
  readonly target: ColorTokenName;

  /** A color role the assigned value reads. */
  readonly role: ColorTokenName;

  /** The assigning class, as written. */
  readonly token: string;
};

/**
 * The classes in a module that assign a contract color token's own custom property, such as
 * Toast's `[--ring:var(--info-soft-foreground)]`. Under such a class, every class anywhere in the
 * library that draws the target draws the role instead, so the role takes each paint the target
 * is drawn with across the source tree. That is one hop: a target drawn only through another such
 * assignment passes on no paint.
 *
 * @param code - A module's code, comments removed.
 * @returns One entry per role each assigning class reads, in source order.
 */
export function tokenAssignments(code: string): TokenAssignment[] {
  return assignments(classTokens(code)).flatMap(({ name, roles, token }) =>
    isColorTokenName(name) ? roles.map((role) => ({ target: name, role, token })) : []
  );
}
