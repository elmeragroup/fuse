import { expect, vi } from "vitest";

import type { ColorScheme, ColorSchemeBootstrapManifest } from "../src/theme/color-scheme";
import { useTheme } from "../src/theme/theme-provider";
import type { ThemeInput } from "../src/theme/tokens/themes";
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
    variant: document.documentElement.getAttribute("data-theme-variant"),
    brand: document.documentElement.getAttribute("data-theme-brand"),
    segment: document.documentElement.getAttribute("data-theme-segment"),
  };
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

/** Clears local storage and dispatches the whole-store `storage` event (`key` is `null`). */
export function emitStorageClear() {
  window.localStorage.clear();
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: null,
      oldValue: null,
      newValue: null,
      storageArea: window.localStorage,
    })
  );
}

export function stubPrefersColorScheme(prefersDark: boolean) {
  let matches = prefersDark;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  // SAFETY: test double implements the MediaQueryList surface the provider listens to.
  const media = {
    get matches() {
      return matches;
    },
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type !== "change") {
        return;
      }
      listeners.add((event) => {
        if ("handleEvent" in listener) {
          listener.handleEvent(event);
          return;
        }
        listener(event);
      });
    },
    removeEventListener() {
      return undefined;
    },
    addListener() {
      return undefined;
    },
    removeListener() {
      return undefined;
    },
    dispatchEvent() {
      return true;
    },
  } as MediaQueryList;
  const nativeMatchMedia = window.matchMedia.bind(window);

  vi.spyOn(window, "matchMedia").mockImplementation((query) => {
    if (query === "(prefers-color-scheme: dark)") {
      return media;
    }
    return nativeMatchMedia(query);
  });

  return {
    setPrefersDark(next: boolean) {
      matches = next;
      // SAFETY: listeners only read matches/media from the change payload.
      const event = { matches: next, media: media.media } as MediaQueryListEvent;
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}
