import { expect, vi } from "vitest";

import { resolveColorSchemeOptions } from "../src/theme/color-scheme";
import type { ColorScheme, ColorSchemeBootstrapManifest } from "../src/theme/color-scheme";
import { themeAttributes } from "../src/theme/theme-attributes";
import { useTheme } from "../src/theme/theme-provider";
import type { ThemeInput } from "../src/theme/tokens/themes";
import { useColorScheme } from "../src/theme/use-color-scheme";

export const fkasPrivate = { variant: "internal", brand: "fkas", segment: "private" } as const;
export const tkasCompany = { variant: "external", brand: "tkas", segment: "company" } as const;
export const guenPrivate = { variant: "internal", brand: "guen", segment: "private" } as const;

export const defaultManifest = resolveColorSchemeOptions();

export function writeManifest(manifest: ColorSchemeBootstrapManifest | undefined) {
  if (manifest === undefined) {
    delete globalThis.__ELMERA_COLOR_SCHEME_BOOTSTRAP__;
    return;
  }
  globalThis.__ELMERA_COLOR_SCHEME_BOOTSTRAP__ = manifest;
}

export function stampDocumentBrand(theme: ThemeInput) {
  const attributes = themeAttributes(theme);
  document.documentElement.setAttribute("data-theme-variant", attributes["data-theme-variant"]);
  document.documentElement.setAttribute("data-theme-brand", attributes["data-theme-brand"]);
  document.documentElement.setAttribute("data-theme-segment", attributes["data-theme-segment"]);
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
