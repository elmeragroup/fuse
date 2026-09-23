import { assignedTokenNames, derivedRoleSources, isDerivedTokenName, TOKEN_NAMES } from "./contract";
import type { TokenLayer, TokenName } from "./contract";
import { DEFAULTS } from "./defaults";
import { paletteLayers } from "./palette-layers";
import { LEGAL_THEMES } from "./themes";

const VARIABLE_REFERENCE = /^var\(--([a-z0-9-]+)\)$/;

/** The role a `var(--role)` default points at, or `undefined` for literal values. */
export function aliasTarget(value: string): string | undefined {
  return VARIABLE_REFERENCE.exec(value)?.[1];
}

/**
 * The roles a token's value reads. A derived role reads its sources, a `var(--role)` default
 * reads its target, and a literal default reads none.
 */
function tokenSources(name: TokenName): readonly string[] {
  if (isDerivedTokenName(name)) {
    return derivedRoleSources(name);
  }
  const target = aliasTarget(DEFAULTS[name]);
  return target === undefined ? [] : [target];
}

/**
 * Every token name the given layers can change, in `TOKEN_NAMES` order. An `undefined`
 * layer — a theme with no segment sheet — is skipped rather than replaced with an empty
 * object.
 */
function resetKeysFor(layers: readonly (TokenLayer | undefined)[]): readonly TokenName[] {
  const changedKeys = new Set<string>();
  for (const layer of layers) {
    if (layer === undefined) continue;
    for (const name of assignedTokenNames(layer)) {
      changedKeys.add(name);
    }
  }

  // An inherited alias or derived value has already resolved against its parent's
  // variables. Reset it wherever a scope resets a role it reads. No source is itself an
  // alias or derived role today, so this iteration is defensive. It keeps the closure
  // correct if one is ever added, independent of `TOKEN_NAMES` order.
  let addedDependent = true;
  while (addedDependent) {
    addedDependent = false;
    for (const name of TOKEN_NAMES) {
      if (changedKeys.has(name)) continue;
      if (tokenSources(name).some((source) => changedKeys.has(source))) {
        changedKeys.add(name);
        addedDependent = true;
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
