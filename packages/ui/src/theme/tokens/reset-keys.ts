import { assignedTokenNames, EXTERNAL_RESET_KEYS, TOKEN_NAMES } from "./contract";
import { DEFAULTS } from "./defaults";
import { externalDarkPalette } from "./external-dark-palettes";
import { INTERNAL_DARK_PALETTE } from "./internal-dark-palette";
import { LEGAL_THEMES } from "./themes";

const changedKeys = new Set<string>(EXTERNAL_RESET_KEYS);
for (const name of assignedTokenNames(INTERNAL_DARK_PALETTE)) changedKeys.add(name);
for (const theme of LEGAL_THEMES) {
  if (theme.variant !== "external") continue;
  for (const name of assignedTokenNames(externalDarkPalette(theme))) {
    changedKeys.add(name);
  }
}

const VARIABLE_REFERENCE = /^var\(--([a-z0-9-]+)\)$/;

/** The role a `var(--role)` default points at, or `undefined` for literal values. */
export function aliasTarget(value: string): string | undefined {
  return VARIABLE_REFERENCE.exec(value)?.[1];
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

export const THEME_RESET_KEYS = TOKEN_NAMES.filter((name) => changedKeys.has(name));
