import type { ScriptHTMLAttributes } from "react";

import { COLOR_SCHEMES } from "./color-scheme-types";
import type { ColorScheme, ResolvedColorScheme } from "./color-scheme-types";

// Types live in ./color-scheme-types so the Node-only scripts program never pulls in this DOM module.
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

export function resolveSystemColorScheme(): ResolvedColorScheme {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function resolveColorScheme(preference: ColorScheme, enableSystem: boolean): ResolvedColorScheme {
  if (preference === "light" || preference === "dark") {
    return preference;
  }
  if (!enableSystem) {
    return "light";
  }
  return resolveSystemColorScheme();
}

/**
 * Runs `operation` against `window.localStorage`, returning `undefined` when the area is
 * unreachable or the operation throws. The property access can throw `SecurityError`
 * when storage is blocked, and `setItem` can throw `QuotaExceededError` on an
 * otherwise readable area (quota full; legacy Safari private mode), so the try/catch
 * has to wrap the operation, not just the access.
 */
function withLocalStorage<T>(operation: (area: Storage) => T): T | undefined {
  try {
    return operation(window.localStorage);
  } catch {
    return undefined;
  }
}

/**
 * Whether a `storage` event should be read as a change to the color-scheme preference:
 * it comes from `localStorage` and names the key, or is a whole-store clear (`key` is
 * `null`), which affects the preference too. `event.newValue` then carries the change.
 */
export function isColorSchemeStorageEvent(event: StorageEvent, storageKey: string): boolean {
  if (event.key !== null && event.key !== storageKey) {
    return false;
  }
  return withLocalStorage((area) => event.storageArea === area) === true;
}

export function readStoredColorScheme(storageKey: string, fallback: ColorScheme): ColorScheme {
  return parseColorScheme(
    withLocalStorage((area) => area.getItem(storageKey)),
    fallback
  );
}

export function writeStoredColorScheme(storageKey: string, value: ColorScheme): void {
  withLocalStorage((area) => {
    area.setItem(storageKey, value);
  });
}

export function readDocumentColorScheme(): ResolvedColorScheme | undefined {
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

export function writeDocumentColorScheme(value: ResolvedColorScheme): void {
  try {
    document.documentElement.setAttribute("data-theme", value);
  } catch {
    // document unavailable
  }
}
