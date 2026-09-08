import type { ScriptHTMLAttributes } from "react";

export type ColorScheme = "light" | "dark" | "system";

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
  resolvedColorScheme: "light" | "dark" | undefined;
  setColorScheme: (value: ColorScheme) => void;
};

export const DEFAULT_COLOR_SCHEME_STORAGE_KEY = "elmera-color-scheme";
export const DEFAULT_COLOR_SCHEME: ColorScheme = "system";
export const DEFAULT_ENABLE_SYSTEM = true;

export function closedColorScheme(value: string | null | undefined): ColorScheme | undefined {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return undefined;
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
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return fallback;
}

export function resolveSystemColorScheme(): "light" | "dark" {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function resolveColorScheme(preference: ColorScheme, enableSystem: boolean): "light" | "dark" {
  if (preference === "light" || preference === "dark") {
    return preference;
  }
  if (!enableSystem) {
    return "light";
  }
  return resolveSystemColorScheme();
}

export function localStorageArea(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function readStoredColorScheme(storageKey: string, fallback: ColorScheme): ColorScheme {
  try {
    return parseColorScheme(localStorage.getItem(storageKey), fallback);
  } catch {
    return parseColorScheme(null, fallback);
  }
}

export function writeStoredColorScheme(storageKey: string, value: ColorScheme): void {
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    // storage unavailable
  }
}

export function readDocumentColorScheme(): "light" | "dark" | undefined {
  try {
    const value = document.documentElement.getAttribute("data-theme");
    if (value === "light" || value === "dark") {
      return value;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function writeDocumentColorScheme(value: "light" | "dark"): void {
  try {
    document.documentElement.setAttribute("data-theme", value);
  } catch {
    // document unavailable
  }
}
