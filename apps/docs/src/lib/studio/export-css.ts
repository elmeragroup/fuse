import { themeAttributes } from "@elmeragroup/fuse/theme";

import { restatedAliases } from "./artboard-style";
import type { Declarations } from "./artboard-style";
import type { StudioDocument, TokenOverrides } from "./edits";
import { STUDIO_TOKEN_NAMES, isLightOnly } from "./tokens";
import type { TokenName } from "./tokens";

const DARK = `[data-theme="dark"]`;

/** The theme's attribute selector, such as `[data-theme-variant="external"][…]`. */
function themeSelector(document: StudioDocument): string {
  return Object.entries(themeAttributes(document.theme))
    .map(([attribute, value]) => `[${attribute}="${value}"]`)
    .join("");
}

/** Declares `value` for `name` in `rule`, when there is one. */
function put(rule: Partial<Record<TokenName, string>>, name: TokenName, value: string | undefined): void {
  if (value !== undefined) {
    rule[name] = value;
  }
}

function rule(comment: string, selectors: readonly string[], declarations: TokenOverrides): string {
  const body = STUDIO_TOKEN_NAMES.flatMap((name) => {
    const value = declarations[name];
    return value === undefined ? [] : [`  --${name}: ${value};`];
  });
  return `/* ${comment} */\n${selectors.join(",\n")} {\n${body.join("\n")}\n}`;
}

/** The base theme's declared CSS in each scheme, keyed by token name. */
export type BaseDeclarations = { readonly light: Declarations; readonly dark: Declarations };

/**
 * The CSS a host pastes after the Fuse stylesheet to apply the edits, in the override pattern
 * the theming handbook documents. Each rule ties or outweighs the theme rule it overrides, so it
 * wins by coming later:
 *
 * - Light edits go on the theme's attribute selector.
 * - Dark edits go on the handbook's two-selector dark pair. A token the light rule declares is
 *   restated there with the base theme's dark value, because the light rule also matches a dark
 *   scope and would otherwise outweigh the base theme's dark rule.
 * - Light-only edits appear once, on the light selector and the dark pair together, since a
 *   dark segment rule restates them at the dark pair's weight.
 * - Each rule also restates the base aliases that read its edits, the closure the studio's
 *   artboards restate ({@link restatedAliases}), so the CSS works on a nested theme scope as well
 *   as on `<html>`. A light-only alias goes in the rule for both schemes.
 *
 * @param document - The base theme and the edits.
 * @param base - The base theme's declared CSS in each scheme.
 * @returns The rules, or a comment saying there is nothing to paste.
 */
export function exportCss(document: StudioDocument, base: BaseDeclarations): string {
  const { light, dark, shared } = document.overrides;
  const selector = themeSelector(document);
  const darkPair = [`${DARK} ${selector}`, `${selector}${DARK}`];

  const lightAliases = restatedAliases([...Object.keys(light), ...Object.keys(shared)], base.light);
  const darkAliases = restatedAliases([...Object.keys(dark), ...Object.keys(shared)], base.dark);
  const lightDeclarations: Partial<Record<TokenName, string>> = {};
  const darkDeclarations: Partial<Record<TokenName, string>> = {};
  const sharedDeclarations: Partial<Record<TokenName, string>> = {};
  for (const name of STUDIO_TOKEN_NAMES) {
    const lightAlias = lightAliases[name];
    const darkAlias = darkAliases[name];
    if (isLightOnly(name)) {
      put(sharedDeclarations, name, shared[name] ?? lightAlias ?? darkAlias);
      continue;
    }
    put(lightDeclarations, name, light[name] ?? lightAlias);
    const restated = lightDeclarations[name] === undefined ? undefined : base.dark[name];
    put(darkDeclarations, name, dark[name] ?? darkAlias ?? restated);
  }

  const rules: string[] = [];
  if (Object.keys(lightDeclarations).length > 0) {
    rules.push(rule("Light.", [selector], lightDeclarations));
  }
  if (Object.keys(darkDeclarations).length > 0) {
    rules.push(
      rule(
        "Dark. The first selector matches under a dark ancestor, the second an element that is\n   dark itself, such as a themed <html>.",
        darkPair,
        darkDeclarations
      )
    );
  }
  if (Object.keys(sharedDeclarations).length > 0) {
    rules.push(
      rule(
        "Both schemes: a dark palette keeps these from light.",
        [selector, ...darkPair],
        sharedDeclarations
      )
    );
  }
  if (rules.length === 0) {
    return "/* No edits: every token keeps the base theme's value. */\n";
  }
  return `/* After the Fuse stylesheet, on the element that carries the theme attributes. */\n\n${rules.join("\n\n")}\n`;
}
