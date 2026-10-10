import type { TokenOverrides } from "./edits";
import { referencedNames } from "./token-values";

/** Inline custom property declarations, keyed `--name`. */
export type CustomProperties = { [property: `--${string}`]: string };

/** A scheme's declared CSS, keyed by token name. */
export type Declarations = Readonly<Record<string, string>>;

/**
 * The base declarations to restate where `declared` are declared: each one that reads a declared
 * property, directly or through another restated one, with its base value.
 *
 * An alias or a live mix resolves where it is declared, and an element inherits the result,
 * not the formula. A light theme rule declares only the roles a palette can change, so roles
 * such as `--destructive: var(--error)` are declared on `:root` alone, and an `--error` edit on
 * a nested scope would not reach them. Restating them beside the edit is Fuse's own reset
 * closure, which restates a derived role wherever a scope resets a source. Nothing is
 * recomputed: the browser resolves the restated formula against the edit.
 *
 * @param declared - The names declared on the element, such as the edited tokens.
 * @param base - The base theme's declared CSS in the element's scheme.
 * @returns The restated declarations, keyed by token name, without the declared ones.
 */
export function restatedAliases(declared: Iterable<string>, base: Declarations) {
  const reached = new Set(declared);
  const restated: Record<string, string> = {};
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, css] of Object.entries(base)) {
      if (!reached.has(name) && referencedNames(css).some((target) => reached.has(target))) {
        restated[name] = css;
        reached.add(name);
        grew = true;
      }
    }
  }
  return restated;
}

/**
 * The inline declarations that apply `overrides` on an artboard's theme scope: each edit, and
 * the base aliases that read one, restated so they resolve against the edit on the scope (see
 * {@link restatedAliases}).
 *
 * @param overrides - The edits that apply in the artboard's scheme.
 * @param base - The base theme's declared CSS in that scheme, keyed by token name, or
 *   `undefined` while it loads.
 * @returns The declarations for the scope element's `style`.
 */
export function artboardStyle(overrides: TokenOverrides, base: Declarations | undefined) {
  const style: CustomProperties = {};
  if (base !== undefined) {
    for (const [name, css] of Object.entries(restatedAliases(Object.keys(overrides), base))) {
      style[`--${name}`] = css;
    }
  }
  for (const [name, value] of Object.entries(overrides)) {
    style[`--${name}`] = value;
  }
  return style;
}
