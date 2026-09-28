import type { ScriptHTMLAttributes } from "react";

import { COLOR_SCHEMES } from "./color-scheme-types";
import type { ColorScheme, ResolvedColorScheme } from "./color-scheme-types";

// The axis lives in ./color-scheme-types so theme composition and CSS generation can read it
// without depending on this React-facing bootstrap module.
export type { ColorScheme, ResolvedColorScheme } from "./color-scheme-types";

export const COLOR_SCHEME_BOOTSTRAP_MANIFEST_KEY = "__ELMERA_COLOR_SCHEME_BOOTSTRAP__";
export const COLOR_SCHEME_BOOTSTRAP_SOURCE_DESCRIPTION = "elmera.colorScheme.bootstrapSource";
export const COLOR_SCHEME_BOOTSTRAP_SOURCE_KEY = Symbol.for(COLOR_SCHEME_BOOTSTRAP_SOURCE_DESCRIPTION);
export const COLOR_SCHEME_BOOTSTRAP_SOURCE_PROVIDER = "provider";
export const COLOR_SCHEME_BOOTSTRAP_SOURCE_DUPLICATE = "duplicate";

export type ColorSchemeBootstrapManifest = {
  storageKey: string;
  defaultColorScheme: ColorScheme;
  enableSystem: boolean;
  forcedColorScheme: ColorScheme | undefined;
};

declare global {
  var __ELMERA_COLOR_SCHEME_BOOTSTRAP__: ColorSchemeBootstrapManifest | undefined;
}

export type ColorSchemeOptions = {
  storageKey?: string;
  defaultColorScheme?: ColorScheme;
  enableSystem?: boolean;
  forcedColorScheme?: ColorScheme;
};

export type ColorSchemeScriptElementProps = Omit<
  ScriptHTMLAttributes<HTMLScriptElement>,
  "type" | "src" | "children" | "dangerouslySetInnerHTML"
> & {
  "data-cfasync"?: string;
};

export type ColorSchemeScriptProps = ColorSchemeOptions & {
  nonce?: string;
  scriptProps?: ColorSchemeScriptElementProps;
};

export type UseColorSchemeResult = {
  colorScheme: ColorScheme;
  resolvedColorScheme: ResolvedColorScheme | undefined;
  setColorScheme: (value: ColorScheme) => void;
};

export const DEFAULT_COLOR_SCHEME_STORAGE_KEY = "elmera-color-scheme";
export const DEFAULT_COLOR_SCHEME: ColorScheme = "system";
export const DEFAULT_ENABLE_SYSTEM = true;

function closedColorScheme(value: string | null | undefined): ColorScheme | undefined {
  return COLOR_SCHEMES.find((scheme) => scheme === value);
}

export function resolveColorSchemeOptions({
  storageKey = DEFAULT_COLOR_SCHEME_STORAGE_KEY,
  defaultColorScheme = DEFAULT_COLOR_SCHEME,
  enableSystem = DEFAULT_ENABLE_SYSTEM,
  forcedColorScheme,
}: ColorSchemeOptions = {}): ColorSchemeBootstrapManifest {
  return {
    storageKey,
    defaultColorScheme: closedColorScheme(defaultColorScheme) ?? DEFAULT_COLOR_SCHEME,
    enableSystem,
    forcedColorScheme: closedColorScheme(forcedColorScheme),
  };
}

export function colorSchemeManifestsEqual(
  left: ColorSchemeBootstrapManifest,
  right: ColorSchemeBootstrapManifest
): boolean {
  return (
    left.storageKey === right.storageKey &&
    left.defaultColorScheme === right.defaultColorScheme &&
    left.enableSystem === right.enableSystem &&
    left.forcedColorScheme === right.forcedColorScheme
  );
}

export function readColorSchemeBootstrapManifest(): ColorSchemeBootstrapManifest | undefined {
  try {
    return globalThis[COLOR_SCHEME_BOOTSTRAP_MANIFEST_KEY];
  } catch {
    return undefined;
  }
}

export function serializeScriptData(value: string | boolean): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

export function parseColorScheme(value: string | null | undefined, fallback: ColorScheme): ColorScheme {
  return closedColorScheme(value) ?? fallback;
}
