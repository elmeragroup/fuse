import type {
  ColorScheme,
  ColorSchemeOptions,
  Density,
  ThemeIdentity,
  ThemeInput,
  ThemeSegment,
} from "@elmeragroup/fuse/theme";

export const DOCUMENT_THEME = {
  identity: "neutral",
  brand: "elma",
  segment: "private",
} as const satisfies ThemeInput;

export const DOCUMENT_COLOR_SCHEME = {
  storageKey: "elmera-color-scheme",
  defaultColorScheme: "system",
  enableSystem: true,
} as const satisfies ColorSchemeOptions;

export const DEFAULT_THEME = {
  identity: "neutral",
  brand: "fkas",
  segment: "private",
} as const satisfies ThemeInput;

/** The branded theme the landing paints on first load and the studio's artboards open on. */
export const OPENING_THEME = {
  identity: "branded",
  brand: "elma",
  segment: "private",
} as const satisfies ThemeInput;

export const COLOR_SCHEME_LABELS = {
  light: "Light",
  dark: "Dark",
  system: "System",
} satisfies Record<ColorScheme, string>;

/** Display labels for the theme-identity axis. */
export const IDENTITY_LABELS = {
  neutral: "Neutral",
  branded: "Branded",
} satisfies Record<ThemeIdentity, string>;

/**
 * The density the docs site previews each identity at: neutral dense, the look of an internal
 * tool, and branded comfortable, the look of a customer-facing page. This is the docs site's own
 * policy, not a Fuse rule. Fuse ties no density to an identity, and a host picks one per document,
 * such as a branded dashboard at dense.
 */
const DOCS_DENSITY_BY_IDENTITY = {
  neutral: "dense",
  branded: "comfortable",
} as const satisfies Record<ThemeIdentity, Density>;

/**
 * The density the docs site previews a theme at.
 *
 * @param theme - The theme on the document or stage.
 * @returns The docs site's density for the theme's identity.
 */
export function docsDensityFor(theme: Pick<ThemeInput, "identity">): Density {
  return DOCS_DENSITY_BY_IDENTITY[theme.identity];
}

/** Display labels for the theme-segment axis. */
export const SEGMENT_LABELS = {
  private: "Private",
  company: "Company",
} satisfies Record<ThemeSegment, string>;
