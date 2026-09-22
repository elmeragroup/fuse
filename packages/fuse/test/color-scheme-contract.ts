import type { ColorSchemeBootstrapManifest } from "../src/theme/color-scheme";

// Written by hand: importing the production diagnostics would let a changed message pass
// both the provider and its assertion.

/** The manifest the bootstrap script records for the documented default options. */
export const DEFAULT_BOOTSTRAP_MANIFEST: ColorSchemeBootstrapManifest = {
  storageKey: "elmera-color-scheme",
  defaultColorScheme: "system",
  enableSystem: true,
  forcedColorScheme: undefined,
};

/** A manifest that disagrees with the defaults on every field. */
export const MISMATCHED_BOOTSTRAP_MANIFEST: ColorSchemeBootstrapManifest = {
  storageKey: "other-key",
  defaultColorScheme: "light",
  enableSystem: false,
  forcedColorScheme: "dark",
};

/** Warned when no bootstrap manifest ran before the provider mounted. */
export const MISSING_BOOTSTRAP_MESSAGE =
  "ThemeProvider did not find the color-scheme bootstrap manifest. Place ColorSchemeScript or colorSchemeScriptSource in the host document before paintable content.";

/** Warned when injection is on although a bootstrap manifest already ran. */
export const DUPLICATE_BOOTSTRAP_MESSAGE =
  "ThemeProvider injectColorSchemeScript is enabled, but a color-scheme bootstrap already ran. Disable injection when the host places the script.";

/** Warned when a default-configured provider finds `MISMATCHED_BOOTSTRAP_MANIFEST`. */
export const MISMATCH_BOOTSTRAP_MESSAGE =
  'ThemeProvider color-scheme configuration does not match the bootstrap manifest. Expected {"storageKey":"elmera-color-scheme","defaultColorScheme":"system","enableSystem":true}, found {"storageKey":"other-key","defaultColorScheme":"light","enableSystem":false,"forcedColorScheme":"dark"}.';
