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
  "secondary-hover",
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
  "radius-step",
  "font-sans",
  "font-heading",
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];

export type TokenContract = {
  [Name in TokenName]: string;
};

/**
 * The roles the pipeline computes from other composed roles instead of reading from a
 * layer. `withDerivedTokens` in `derived-tokens.ts` owns how each one is computed.
 */
export const DERIVED_TOKEN_NAMES = ["secondary-hover"] as const satisfies readonly TokenName[];

/** A role the pipeline computes from other composed roles. */
export type DerivedTokenName = (typeof DERIVED_TOKEN_NAMES)[number];

/** A role a palette, sheet, pointer or the defaults assign directly. */
export type LayerTokenName = Exclude<TokenName, DerivedTokenName>;

/** Every role a layer can assign, each with a value. It is a composed theme before derivation. */
export type LayerTokens = Pick<TokenContract, LayerTokenName>;

/**
 * The roles one layer assigns. A derived role is not assignable, so a layer cannot set a
 * value that composition would overwrite.
 */
export type TokenLayer = Partial<LayerTokens>;

/**
 * Whether the pipeline computes this role rather than reading it from a layer.
 *
 * @param name - A contract token name.
 * @returns `true` for a derived role.
 */
export function isDerivedTokenName(name: TokenName): name is DerivedTokenName {
  return DERIVED_TOKEN_NAMES.some((derived) => derived === name);
}

function isLayerTokenName(name: TokenName): name is LayerTokenName {
  return !isDerivedTokenName(name);
}

/** Every role a layer can assign, in `TOKEN_NAMES` order. */
export const LAYER_TOKEN_NAMES: readonly LayerTokenName[] = TOKEN_NAMES.filter(isLayerTokenName);

/**
 * The roles a light theme rule resets: every key an external palette or segment delta can
 * assign, plus each derived role computed from them.
 */
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
  "secondary-hover",
  "secondary-soft",
  "secondary-soft-foreground",
  "feature",
  "feature-bright",
  "feature-foreground",
  "border",
  "input",
  "radius",
  "radius-button",
  "radius-step",
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
  "radius-step",
  "brand",
  "brand-foreground",
] as const;

export const MUST_OVERRIDE_INTERNAL = ["brand", "brand-foreground"] as const;

/** Geometry and typography a dark palette keeps from the light composition. */
const LIGHT_ONLY_KEYS: ReadonlySet<TokenName> = new Set([
  "radius",
  "radius-button",
  "radius-step",
  "font-heading",
]);

/**
 * The roles every dark palette must override. Geometry and typography (`radius`,
 * `radius-button`, `radius-step`, `font-heading`) intentionally keep their light values,
 * and a derived role is computed rather than supplied, so those are the only
 * `EXTERNAL_RESET_KEYS` entries a dark palette need not name.
 */
export const MUST_OVERRIDE_DARK = EXTERNAL_RESET_KEYS.filter(
  (key): key is Extract<ExternalResetKey, LayerTokenName> =>
    isLayerTokenName(key) && !LIGHT_ONLY_KEYS.has(key)
);

export function assignedTokenNames(layer: TokenLayer): LayerTokenName[] {
  const names: LayerTokenName[] = [];
  for (const name of LAYER_TOKEN_NAMES) {
    if (layer[name] !== undefined) {
      names.push(name);
    }
  }
  return names;
}

export function mergeTokenLayers(...layers: TokenLayer[]): TokenLayer {
  const merged: TokenLayer = {};
  for (const layer of layers) {
    for (const name of LAYER_TOKEN_NAMES) {
      const value = layer[name];
      if (value !== undefined) {
        merged[name] = value;
      }
    }
  }
  return merged;
}

export function overlayTokenLayers(base: LayerTokens, ...layers: TokenLayer[]): LayerTokens {
  return { ...base, ...mergeTokenLayers(...layers) };
}
