export const TOKEN_NAMES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "card-soft",
  "card-soft-foreground",
  "popover",
  "popover-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "feature",
  "feature-bright",
  "feature-foreground",
  "primary",
  "primary-foreground",
  "primary-soft",
  "primary-soft-foreground",
  "secondary",
  "secondary-foreground",
  "secondary-soft",
  "secondary-soft-foreground",
  "brand",
  "brand-foreground",
  "error",
  "error-foreground",
  "error-soft",
  "error-soft-foreground",
  "info",
  "info-foreground",
  "info-soft",
  "info-soft-foreground",
  "success",
  "success-foreground",
  "success-soft",
  "success-soft-foreground",
  "warning",
  "warning-foreground",
  "warning-soft",
  "warning-soft-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "sidebar",
  "sidebar-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
  "sidebar-brand",
  "sidebar-brand-foreground",
  "right-panel",
  "right-panel-foreground",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-7",
  "chart-8",
  "sh-identifier",
  "sh-keyword",
  "sh-string",
  "sh-class",
  "sh-property",
  "sh-entity",
  "sh-jsxliterals",
  "sh-sign",
  "sh-comment",
  "radius",
  "radius-button",
  "font-sans",
  "font-heading",
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];

export type TokenContract = {
  [Name in TokenName]: string;
};

export const EXTERNAL_RESET_KEYS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "card-soft",
  "card-soft-foreground",
  "muted",
  "muted-foreground",
  "primary",
  "primary-foreground",
  "primary-soft",
  "primary-soft-foreground",
  "secondary",
  "secondary-foreground",
  "secondary-soft",
  "secondary-soft-foreground",
  "feature",
  "feature-bright",
  "feature-foreground",
  "border",
  "input",
  "radius",
  "radius-button",
  "font-heading",
] as const;

export type ExternalResetKey = (typeof EXTERNAL_RESET_KEYS)[number];

export const MUST_OVERRIDE_EXTERNAL = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "card-soft",
  "card-soft-foreground",
  "muted",
  "muted-foreground",
  "primary",
  "primary-foreground",
  "primary-soft",
  "primary-soft-foreground",
  "secondary",
  "secondary-foreground",
  "secondary-soft",
  "secondary-soft-foreground",
  "feature",
  "feature-bright",
  "feature-foreground",
  "border",
  "input",
  "radius",
  "radius-button",
  "brand",
  "brand-foreground",
] as const;

export const MUST_OVERRIDE_INTERNAL = ["brand", "brand-foreground"] as const;

export type MustOverrideKey =
  | (typeof MUST_OVERRIDE_EXTERNAL)[number]
  | (typeof MUST_OVERRIDE_INTERNAL)[number];

export function pickTokenKeys<const Keys extends readonly TokenName[]>(
  tokens: TokenContract,
  keys: Keys
): Pick<TokenContract, Keys[number]> {
  const picked: Partial<TokenContract> = {};
  for (const key of keys) {
    picked[key] = tokens[key];
  }
  // SAFETY: every key in `keys` was copied from `tokens`, so the pick is complete.
  return picked as Pick<TokenContract, Keys[number]>;
}

export function assignedTokenNames(layer: Partial<TokenContract>): TokenName[] {
  const names: TokenName[] = [];
  for (const name of TOKEN_NAMES) {
    if (layer[name] !== undefined) {
      names.push(name);
    }
  }
  return names;
}

export function mergeTokenLayers(...layers: Partial<TokenContract>[]): Partial<TokenContract> {
  const merged: Partial<TokenContract> = {};
  for (const layer of layers) {
    for (const name of TOKEN_NAMES) {
      const value = layer[name];
      if (value !== undefined) {
        merged[name] = value;
      }
    }
  }
  return merged;
}

export function overlayTokenLayers(base: TokenContract, ...layers: Partial<TokenContract>[]): TokenContract {
  return { ...base, ...mergeTokenLayers(...layers) };
}
