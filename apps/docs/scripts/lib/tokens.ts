/**
 * Tokens-consumed extraction.
 *
 * Purely lexical and therefore reproducible: every token comes from something the
 * recipe source literally says. Three shapes are recognised —
 *
 *   1. `var(--token)` written directly in a recipe or CSS file,
 *   2. Tailwind v4's CSS-variable shorthand, `h-(--control-h-md)`,
 *   3. Tailwind colour utilities (`bg-primary`, `ring-error/20`), resolved through the
 *      `@theme inline` block of `packages/fuse/src/styles/fuse.css` — the library's own
 *      utility → token map, so no token name is ever hand-listed here.
 *
 * Only the utility *prefixes* in `COLOR_UTILITY_PREFIXES` are Tailwind knowledge; a
 * candidate becomes a token only when its suffix is present in that generated map, so
 * `text-sm` resolves to nothing while `text-primary` resolves to `--primary`.
 */

import { readFileSync } from "node:fs";

import type { TokenRef } from "../../src/lib/docs-model.ts";

/** Tailwind utility namespaces whose value is a colour. */
const COLOR_UTILITY_PREFIXES = [
  "accent",
  "bg",
  "border",
  "border-b",
  "border-e",
  "border-l",
  "border-r",
  "border-s",
  "border-t",
  "border-x",
  "border-y",
  "caret",
  "decoration",
  "divide",
  "fill",
  "from",
  "outline",
  "placeholder",
  "ring",
  "ring-offset",
  "shadow",
  "stroke",
  "text",
  "to",
  "via",
] as const;

const THEME_INLINE_START = /@theme\s+inline\s*\{/;

export type ColorTokenMap = ReadonlyMap<string, string>;

/**
 * Reads the `--color-<utility>: var(--<token>)` pairs out of the library's
 * `@theme inline` block. The keys are Tailwind utility suffixes; the values are the
 * theme tokens those utilities actually read.
 */
export function readColorTokenMap(fuseCssText: string): ColorTokenMap {
  const start = THEME_INLINE_START.exec(fuseCssText);
  if (start === null) {
    throw new Error("packages/fuse/src/styles/fuse.css has no `@theme inline` block to derive tokens from");
  }
  const from = start.index + start[0].length;
  let depth = 1;
  let cursor = from;
  while (cursor < fuseCssText.length && depth > 0) {
    const character = fuseCssText[cursor];
    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
    }
    cursor += 1;
  }
  const block = fuseCssText.slice(from, cursor - 1);
  const map = new Map<string, string>();
  const pattern = /--color-([a-z0-9-]+)\s*:\s*var\(\s*(--[a-z0-9-]+)\s*\)/gi;
  let match = pattern.exec(block);
  while (match !== null) {
    const utility = match[1];
    const token = match[2];
    if (utility !== undefined && token !== undefined) {
      map.set(utility, token);
    }
    match = pattern.exec(block);
  }
  if (map.size === 0) {
    throw new Error("packages/fuse/src/styles/fuse.css `@theme inline` block declared no colour tokens");
  }
  return map;
}

/** Strips Tailwind variant prefixes (`hover:`, `data-[open]:`) outside bracket groups. */
function stripVariants(candidate: string): string {
  let depth = 0;
  let lastColon = -1;
  for (let index = 0; index < candidate.length; index += 1) {
    const character = candidate[index];
    if (character === "[" || character === "(") {
      depth += 1;
    } else if (character === "]" || character === ")") {
      depth -= 1;
    } else if (character === ":" && depth === 0) {
      lastColon = index;
    }
  }
  return candidate.slice(lastColon + 1);
}

function colorTokenFor(candidate: string, colors: ColorTokenMap): string | null {
  const bare = stripVariants(candidate).replace(/^[!-]+/, "");
  if (bare.includes("[") || bare.includes("(")) {
    return null;
  }
  const withoutOpacity = bare.split("/")[0] ?? bare;
  for (const prefix of COLOR_UTILITY_PREFIXES) {
    if (!withoutOpacity.startsWith(`${prefix}-`)) {
      continue;
    }
    const suffix = withoutOpacity.slice(prefix.length + 1);
    const token = colors.get(suffix);
    if (token !== undefined) {
      return token;
    }
  }
  return null;
}

/** Every double-quoted string literal in a TS/TSX source, plus raw CSS passed through. */
function stringLiterals(sourceText: string): readonly string[] {
  const literals: string[] = [];
  const pattern = /"((?:[^"\\\n]|\\.)*)"/g;
  let match = pattern.exec(sourceText);
  while (match !== null) {
    const value = match[1];
    if (value !== undefined) {
      literals.push(value);
    }
    match = pattern.exec(sourceText);
  }
  return literals;
}

export type TokenScanInput = {
  /** Recipe / component sources — colour utilities are resolved inside string literals. */
  sources: readonly string[];
  /** Plain CSS files — scanned for `var(--…)` only. */
  stylesheets: readonly string[];
  colors: ColorTokenMap;
};

/** Collects every token the given sources read, sorted and de-duplicated. */
export function extractTokens(input: TokenScanInput): readonly TokenRef[] {
  const found = new Set<string>();
  const colorTokens = new Set(input.colors.values());

  const scanForVars = (text: string): void => {
    const varPattern = /var\(\s*(--[a-z0-9-]+)/gi;
    let match = varPattern.exec(text);
    while (match !== null) {
      const token = match[1];
      if (token !== undefined) {
        found.add(token);
      }
      match = varPattern.exec(text);
    }
    // Tailwind v4 CSS-variable shorthand: `h-(--control-h-md)`, `size-(--control-h-lg)`.
    const shorthandPattern = /(?<!var)\(\s*(--[a-z0-9-]+)\s*\)/gi;
    let shorthand = shorthandPattern.exec(text);
    while (shorthand !== null) {
      const token = shorthand[1];
      if (token !== undefined) {
        found.add(token);
      }
      shorthand = shorthandPattern.exec(text);
    }
  };

  for (const stylesheet of input.stylesheets) {
    scanForVars(stylesheet);
  }
  for (const source of input.sources) {
    scanForVars(source);
    for (const literal of stringLiterals(source)) {
      for (const candidate of literal.split(/\s+/)) {
        if (candidate === "") {
          continue;
        }
        const token = colorTokenFor(candidate, input.colors);
        if (token !== null) {
          found.add(token);
        }
      }
    }
  }

  return [...found]
    .filter((token) => !token.startsWith("--tw-"))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({ name, isColor: colorTokens.has(name) }));
}

export function readColorTokenMapFromFile(fuseCssPath: string): ColorTokenMap {
  return readColorTokenMap(readFileSync(fuseCssPath, "utf8"));
}
