import { assignedTokenNames, TOKEN_NAMES } from "./contract";
import type { TokenContract, TokenName } from "./contract";
import { DEFAULTS } from "./defaults";
import { paletteLayers } from "./palette-layers";
import { LEGAL_THEMES } from "./themes";

const VARIABLE_REFERENCE = /^var\(--([a-z0-9-]+)\)$/;

/** The role a `var(--role)` default points at, or `undefined` for literal values. */
export function aliasTarget(value: string): string | undefined {
  return VARIABLE_REFERENCE.exec(value)?.[1];
}

/**
 * Every token name the given layers can change, in `TOKEN_NAMES` order. An `undefined`
 * layer — a theme with no segment sheet — is skipped rather than replaced with an empty
 * object.
 */
function resetKeysFor(layers: readonly (Partial<TokenContract> | undefined)[]): readonly TokenName[] {
  const changedKeys = new Set<string>();
  for (const layer of layers) {
    if (layer === undefined) continue;
    for (const name of assignedTokenNames(layer)) {
      changedKeys.add(name);
    }
  }

  // An inherited alias has already resolved against its parent's variables. Rebind it
  // wherever a scope resets the role it references. No `DEFAULTS` alias targets another
  // alias today, so this iteration is defensive: it keeps the closure correct if one is
  // ever added, independent of `TOKEN_NAMES` order.
  let addedAlias = true;
  while (addedAlias) {
    addedAlias = false;
    for (const name of TOKEN_NAMES) {
      if (changedKeys.has(name)) continue;
      const target = aliasTarget(DEFAULTS[name]);
      if (target !== undefined && changedKeys.has(target)) {
        changedKeys.add(name);
        addedAlias = true;
      }
    }
  }

  return TOKEN_NAMES.filter((name) => changedKeys.has(name));
}

// Seed from the palette layers themselves, so this module cannot claim a key no layer
// supplies. The theme tests pin the light layers' key union to the documented
// `EXTERNAL_RESET_KEYS` literal.
const paletteLayerList = LEGAL_THEMES.flatMap((theme) => [
  ...paletteLayers(theme, "light"),
  ...paletteLayers(theme, "dark"),
]);

/** Every token name a light or dark palette can change, in `TOKEN_NAMES` order. */
export const THEME_RESET_KEYS = resetKeysFor(paletteLayerList);
