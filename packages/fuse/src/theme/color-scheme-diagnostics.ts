import {
  COLOR_SCHEME_BOOTSTRAP_SOURCE_DUPLICATE,
  COLOR_SCHEME_BOOTSTRAP_SOURCE_KEY,
  COLOR_SCHEME_BOOTSTRAP_SOURCE_PROVIDER,
  colorSchemeManifestsEqual,
  readColorSchemeBootstrapManifest,
} from "./color-scheme";
import type { ColorSchemeBootstrapManifest } from "./color-scheme";
import { isThemeDevelopment } from "./validate-theme";

const COLOR_SCHEME_BOOTSTRAP_MISSING_MESSAGE =
  "ThemeProvider did not find the color-scheme bootstrap manifest. Place ColorSchemeScript or colorSchemeScriptSource in the host document before paintable content.";

const COLOR_SCHEME_BOOTSTRAP_DUPLICATE_MESSAGE =
  "ThemeProvider injectColorSchemeScript is enabled, but a color-scheme bootstrap already ran. Disable injection when the host places the script.";

function colorSchemeBootstrapMismatchMessage(
  expected: ColorSchemeBootstrapManifest,
  found: ColorSchemeBootstrapManifest
): string {
  return (
    "ThemeProvider color-scheme configuration does not match the bootstrap manifest. " +
    `Expected ${JSON.stringify(expected)}, found ${JSON.stringify(found)}.`
  );
}

function readColorSchemeBootstrapSource(
  found: ColorSchemeBootstrapManifest
):
  | typeof COLOR_SCHEME_BOOTSTRAP_SOURCE_PROVIDER
  | typeof COLOR_SCHEME_BOOTSTRAP_SOURCE_DUPLICATE
  | undefined {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(found, COLOR_SCHEME_BOOTSTRAP_SOURCE_KEY);
    if (descriptor?.value === COLOR_SCHEME_BOOTSTRAP_SOURCE_PROVIDER) {
      return COLOR_SCHEME_BOOTSTRAP_SOURCE_PROVIDER;
    }
    if (descriptor?.value === COLOR_SCHEME_BOOTSTRAP_SOURCE_DUPLICATE) {
      return COLOR_SCHEME_BOOTSTRAP_SOURCE_DUPLICATE;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function diagnoseColorSchemeBootstrap(
  expected: ColorSchemeBootstrapManifest,
  injectColorSchemeScript: boolean
): void {
  if (!isThemeDevelopment()) {
    return;
  }

  const found = readColorSchemeBootstrapManifest();
  if (found === undefined) {
    console.warn(COLOR_SCHEME_BOOTSTRAP_MISSING_MESSAGE);
    return;
  }

  if (!colorSchemeManifestsEqual(expected, found)) {
    console.warn(colorSchemeBootstrapMismatchMessage(expected, found));
  }

  if (
    injectColorSchemeScript &&
    readColorSchemeBootstrapSource(found) !== COLOR_SCHEME_BOOTSTRAP_SOURCE_PROVIDER
  ) {
    console.warn(COLOR_SCHEME_BOOTSTRAP_DUPLICATE_MESSAGE);
  }
}
