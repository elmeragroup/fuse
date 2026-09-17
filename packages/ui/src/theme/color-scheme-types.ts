export type ColorScheme = "light" | "dark" | "system";

/** The color-scheme axis in host-facing order; `"system"` resolves against the media query. */
export const COLOR_SCHEMES = ["light", "dark", "system"] as const satisfies readonly ColorScheme[];

/** A color scheme after `"system"` has been resolved against the media query. */
export type ResolvedColorScheme = "light" | "dark";
