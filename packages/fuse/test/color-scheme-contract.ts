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

/** Warned when no bootstrap manifest ran before the provider mounted. */
export const MISSING_BOOTSTRAP_MESSAGE =
  "ThemeProvider did not find the color-scheme bootstrap manifest. Place ColorSchemeScript or colorSchemeScriptSource in the host document before paintable content.";

/** Warned when injection is on although a bootstrap manifest already ran. */
export const DUPLICATE_BOOTSTRAP_MESSAGE =
  "ThemeProvider injectColorSchemeScript is enabled, but a color-scheme bootstrap already ran. Disable injection when the host places the script.";
