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
 * A derived role, mixed from one composed role toward another in OKLCH. `derived-tokens.ts`
 * reads the entry twice. Composition computes the literal that the catalog, the docs and
 * design tools store, and the CSS emitter writes the matching `color-mix()`.
 */
export type OklchMixRole = {
  /** The role the mix starts from. */
  readonly from: TokenName;
  /** The role the mix moves toward. */
  readonly toward: TokenName;
  /** The share of `toward` in percent, as CSS `color-mix()` spells it. */
  readonly percent: number;
};

/**
 * The roles the pipeline computes from other composed roles instead of reading them from
 * a layer, each with the only roles it reads. The reset closure reads the same entry, so a
 * scope that resets a source always resets the derived role too.
 */
export const DERIVED_ROLES = {
  // The secondary Button hover, which the recipe used to spell as an inline color-mix().
  "secondary-hover": { from: "secondary", toward: "foreground", percent: 5 },
} as const satisfies Partial<Record<TokenName, OklchMixRole>>;

/** A role the pipeline computes from other composed roles. */
export type DerivedTokenName = keyof typeof DERIVED_ROLES;

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
  return Object.hasOwn(DERIVED_ROLES, name);
}

function isLayerTokenName(name: TokenName): name is LayerTokenName {
  return !isDerivedTokenName(name);
}

/**
 * The roles a derived role reads, straight from its `DERIVED_ROLES` entry.
 *
 * @param name - A derived role.
 * @returns The role the mix starts from and the role it moves toward.
 */
export function derivedRoleSources(name: DerivedTokenName): readonly [LayerTokenName, LayerTokenName] {
  const role = DERIVED_ROLES[name];
  return [role.from, role.toward];
}

/** Every role a layer can assign, in `TOKEN_NAMES` order. */
export const LAYER_TOKEN_NAMES: readonly LayerTokenName[] = TOKEN_NAMES.filter(isLayerTokenName);

/** What a token's CSS value holds, which decides how exporters translate it. */
export type TokenKind = "color" | "dimension" | "fontFamily";

/**
 * The kind of every token. A new token without a kind fails to compile, so no exporter
 * can file it under a default.
 */
export const TOKEN_KINDS = {
  background: "color",
  foreground: "color",
  card: "color",
  "card-foreground": "color",
  "card-soft": "color",
  "card-soft-foreground": "color",
  popover: "color",
  "popover-foreground": "color",
  muted: "color",
  "muted-foreground": "color",
  accent: "color",
  "accent-foreground": "color",
  feature: "color",
  "feature-bright": "color",
  "feature-foreground": "color",
  primary: "color",
  "primary-foreground": "color",
  "primary-soft": "color",
  "primary-soft-foreground": "color",
  secondary: "color",
  "secondary-foreground": "color",
  "secondary-hover": "color",
  "secondary-soft": "color",
  "secondary-soft-foreground": "color",
  brand: "color",
  "brand-foreground": "color",
  error: "color",
  "error-foreground": "color",
  "error-soft": "color",
  "error-soft-foreground": "color",
  info: "color",
  "info-foreground": "color",
  "info-soft": "color",
  "info-soft-foreground": "color",
  success: "color",
  "success-foreground": "color",
  "success-soft": "color",
  "success-soft-foreground": "color",
  warning: "color",
  "warning-foreground": "color",
  "warning-soft": "color",
  "warning-soft-foreground": "color",
  destructive: "color",
  "destructive-foreground": "color",
  border: "color",
  input: "color",
  ring: "color",
  sidebar: "color",
  "sidebar-foreground": "color",
  "sidebar-accent": "color",
  "sidebar-accent-foreground": "color",
  "sidebar-border": "color",
  "sidebar-ring": "color",
  "sidebar-brand": "color",
  "sidebar-brand-foreground": "color",
  "right-panel": "color",
  "right-panel-foreground": "color",
  "chart-1": "color",
  "chart-2": "color",
  "chart-3": "color",
  "chart-4": "color",
  "chart-5": "color",
  "chart-6": "color",
  "chart-7": "color",
  "chart-8": "color",
  "sh-identifier": "color",
  "sh-keyword": "color",
  "sh-string": "color",
  "sh-class": "color",
  "sh-property": "color",
  "sh-entity": "color",
  "sh-jsxliterals": "color",
  "sh-sign": "color",
  "sh-comment": "color",
  radius: "dimension",
  "radius-button": "dimension",
  "radius-step": "dimension",
  "font-sans": "fontFamily",
  "font-heading": "fontFamily",
} as const satisfies Record<TokenName, TokenKind>;

/**
 * The roles a light theme rule resets. They are every key the external variant layer, an
 * external palette or a segment delta can assign, plus each derived role computed from them.
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
 * `radius-button`, `radius-step`, `font-heading`) keep their light values, and composition
 * computes each derived role, so those are the only `EXTERNAL_RESET_KEYS` entries a dark
 * palette need not name.
 */
export const MUST_OVERRIDE_DARK = EXTERNAL_RESET_KEYS.filter(
  (key): key is Extract<ExternalResetKey, LayerTokenName> =>
    isLayerTokenName(key) && !LIGHT_ONLY_KEYS.has(key)
);

/**
 * The roles one layer assigns.
 *
 * @param layer - A palette, sheet, pointer or defaults layer.
 * @returns The names the layer gives a value, in `TOKEN_NAMES` order.
 */
export function assignedTokenNames(layer: TokenLayer): LayerTokenName[] {
  const names: LayerTokenName[] = [];
  for (const name of LAYER_TOKEN_NAMES) {
    if (layer[name] !== undefined) {
      names.push(name);
    }
  }
  return names;
}

/**
 * Merge layers into one, a later layer's value replacing an earlier one's.
 *
 * @param layers - The layers in application order.
 * @returns One layer that assigns every role any input layer assigns.
 */
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

/**
 * Overlay layers on a complete base, a later layer's value replacing an earlier one's.
 *
 * @param base - A value for every layer role, such as `LAYER_DEFAULTS`.
 * @param layers - The layers in application order.
 * @returns Every layer role with its value after the overlay, before derivation.
 */
export function overlayTokenLayers(base: LayerTokens, ...layers: TokenLayer[]): LayerTokens {
  return { ...base, ...mergeTokenLayers(...layers) };
}
