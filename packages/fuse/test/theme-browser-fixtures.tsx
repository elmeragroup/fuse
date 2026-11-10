import { expect } from "vitest";

import type { ColorScheme, ColorSchemeBootstrapManifest } from "../src/theme/color-scheme";
import type { ThemeInput } from "../src/theme/theme-input";
import { useTheme } from "../src/theme/theme-provider";
import { useColorScheme } from "../src/theme/use-color-scheme";
import { stampTheme } from "./theme-fixtures";

export { fkasPrivate, guenPrivate, tkasCompany } from "./theme-fixtures";

export function writeManifest(manifest: ColorSchemeBootstrapManifest | undefined) {
  if (manifest === undefined) {
    delete globalThis.__ELMERA_COLOR_SCHEME_BOOTSTRAP__;
    return;
  }
  globalThis.__ELMERA_COLOR_SCHEME_BOOTSTRAP__ = manifest;
}

export function stampDocumentBrand(theme: ThemeInput) {
  stampTheme(document.documentElement, theme);
}

export function readDocumentBrand() {
  return {
    identity: document.documentElement.getAttribute("data-theme-identity"),
    brand: document.documentElement.getAttribute("data-theme-brand"),
    segment: document.documentElement.getAttribute("data-theme-segment"),
  };
}

/**
 * Restores the document, bootstrap manifest and web storage a theme browser test may have
 * written, so the next test starts from a blank host page.
 */
export function resetThemeDocument() {
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  root.removeAttribute("data-theme-identity");
  root.removeAttribute("data-theme-brand");
  root.removeAttribute("data-theme-segment");
  root.style.removeProperty("color-scheme");
  // DOM audit: the color-scheme bootstrap writes a role-less <meta> in the head.
  for (const meta of document.querySelectorAll('meta[name="color-scheme"]')) {
    meta.remove();
  }
  writeManifest(undefined);
  window.localStorage.clear();
  window.sessionStorage.clear();
}

export function ColorSchemeOutput() {
  const theme = useTheme();
  const { colorScheme, resolvedColorScheme } = useColorScheme();
  return (
    <output>
      {theme.slug}:{colorScheme}/{resolvedColorScheme ?? "pending"}
    </output>
  );
}

export function ColorSchemeSetter({ value, label = "set" }: { value: ColorScheme; label?: string }) {
  const { setColorScheme } = useColorScheme();
  return (
    <button
      type="button"
      onClick={() => {
        setColorScheme(value);
      }}>
      {label}
    </button>
  );
}

export async function mountedColorScheme(host: HTMLElement, expected: string) {
  await expect.poll(() => host.querySelector("output")?.textContent).toBe(expected);
}

/**
 * Writes `value` under `key` and dispatches the `storage` event another same-origin
 * document would receive for that write. The browser only fires the event in *other*
 * documents, so a test has to stand in for the second tab itself.
 */
export function emitStorageChange(key: string, value: string) {
  const oldValue = window.localStorage.getItem(key);
  window.localStorage.setItem(key, value);
  window.dispatchEvent(
    new StorageEvent("storage", { key, oldValue, newValue: value, storageArea: window.localStorage })
  );
}
