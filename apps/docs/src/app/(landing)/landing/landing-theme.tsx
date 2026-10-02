"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { flushSync } from "react-dom";

import * as CssColor from "@elmeragroup/color/css-color";
import * as Hex from "@elmeragroup/color/hex";
import type * as Srgb from "@elmeragroup/color/srgb";
import { coerceTheme, LocaleProvider, ThemeProvider, useColorScheme } from "@elmeragroup/fuse/theme";
import type { BrandCode, ColorScheme, ThemeInput } from "@elmeragroup/fuse/theme";

import { DOCUMENT_COLOR_SCHEME } from "../../../lib/theme";
import { LANDING_THEME } from "./landing-theme-defaults";

/** Where a re-theme was triggered, so the reveal can grow out of the finger or cursor. */
type RevealOrigin = { x: number; y: number };

type LandingThemeValue = {
  theme: ThemeInput;
  /** Moves the brand; a brand pinned to one segment drags the segment along through `coerceTheme`. */
  changeBrand: (brand: BrandCode) => void;
  changeColorScheme: (scheme: ColorScheme) => void;
  colorScheme: ColorScheme;
};

/** The media query every landing animation defers to. */
export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * A computed colour as sRGB, or undefined when the colour parser does not take it. The
 * status bar and the heat ramps both read the browser's resolved colours through it.
 */
export function computedSrgb(value: string): Srgb.Srgb | undefined {
  const parsed = CssColor.parse(value.trim());
  return parsed._tag === "err" ? undefined : CssColor.toSrgb(parsed.value);
}

const LandingThemeContext = createContext<LandingThemeValue | undefined>(undefined);

const REVEAL_MS = 560;
const REVEAL_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * Runs a DOM-changing update under a circular view-transition reveal centred on the press or
 * the focused control that triggered it.
 *
 * A re-theme is rare and deliberate, so it earns a longer, explanatory animation than a
 * control would. Reduced motion and browsers without view transitions get the instant swap.
 */
function revealUpdate(update: () => void): void {
  const reduce = window.matchMedia(REDUCED_MOTION).matches;
  if (!("startViewTransition" in document) || reduce) {
    update();
    return;
  }
  const { x, y } = resolveOrigin();
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const transition = document.startViewTransition(() => flushSync(update));
  void transition.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: REVEAL_MS, easing: REVEAL_EASE, pseudoElement: "::view-transition-new(root)" }
    );
  });
}

type LandingThemeProviderProps = {
  children: ReactNode;
};

export function LandingThemeProvider({ children }: LandingThemeProviderProps): ReactElement {
  const [theme, setTheme] = useState<ThemeInput>(LANDING_THEME);

  return (
    <ThemeProvider
      theme={theme}
      storageKey={DOCUMENT_COLOR_SCHEME.storageKey}
      defaultColorScheme={DOCUMENT_COLOR_SCHEME.defaultColorScheme}
      enableSystem={DOCUMENT_COLOR_SCHEME.enableSystem}
      injectColorSchemeScript={false}>
      <LocaleProvider locale="en-US">
        <LandingThemeState theme={theme} setTheme={setTheme}>
          {children}
        </LandingThemeState>
      </LocaleProvider>
    </ThemeProvider>
  );
}

type LandingThemeStateProps = {
  theme: ThemeInput;
  setTheme: (theme: ThemeInput) => void;
  children: ReactNode;
};

function LandingThemeState({ theme, setTheme, children }: LandingThemeStateProps): ReactElement {
  const { colorScheme, resolvedColorScheme, setColorScheme } = useColorScheme();

  const changeBrand = useCallback(
    (brand: BrandCode) => {
      const next = coerceTheme({ ...theme, brand });
      if (next === null) {
        return;
      }
      if (next.brand === theme.brand && next.segment === theme.segment) {
        return;
      }
      revealUpdate(() => setTheme(next));
    },
    [theme, setTheme]
  );

  const changeColorScheme = useCallback(
    (next: ColorScheme) => {
      if (next === colorScheme) {
        return;
      }
      revealUpdate(() => setColorScheme(next));
    },
    [colorScheme, setColorScheme]
  );

  usePointerOrigin();
  useStatusBarColor(theme, resolvedColorScheme);

  const value = useMemo(
    (): LandingThemeValue => ({
      theme,
      changeBrand,
      changeColorScheme,
      colorScheme,
    }),
    [theme, changeBrand, changeColorScheme, colorScheme]
  );

  return <LandingThemeContext.Provider value={value}>{children}</LandingThemeContext.Provider>;
}

/**
 * Points both `theme-color` tags at the live `--background`, so the phone's status bar and
 * browser chrome match the top of the page in whichever brand and scheme it wears.
 */
function useStatusBarColor(theme: ThemeInput, scheme: string | undefined): void {
  useEffect(() => {
    // ThemeProvider stamps <html> in an insertion effect, which runs before this one, so the
    // body already wears the new theme here.
    const srgb = computedSrgb(window.getComputedStyle(document.body).backgroundColor);
    if (srgb === undefined) {
      return;
    }
    const hex = Hex.formatOpaque(srgb);
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = hex;
    }
  }, [theme, scheme]);
}

export function useLandingTheme(): LandingThemeValue {
  const value = use(LandingThemeContext);
  if (value === undefined) {
    throw new Error("useLandingTheme must be used within LandingThemeProvider");
  }
  return value;
}

let lastPointer: (RevealOrigin & { at: number }) | undefined;

/**
 * Records where each press lands, so a re-theme can grow from it. Capture phase, so the
 * coordinates exist before any control's own handler runs; a key press clears them so a
 * keyboard change grows from the focused control instead.
 */
function usePointerOrigin(): void {
  useEffect(() => {
    const press = (event: PointerEvent) => {
      lastPointer = { x: event.clientX, y: event.clientY, at: event.timeStamp };
    };
    const key = () => {
      lastPointer = undefined;
    };
    window.addEventListener("pointerdown", press, { capture: true, passive: true });
    window.addEventListener("keydown", key, { capture: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", press, { capture: true });
      window.removeEventListener("keydown", key, { capture: true });
    };
  }, []);
}

/**
 * Where the reveal grows from: the finger or cursor that just pressed, or the centre of the
 * focused control when the change came from the keyboard.
 */
function resolveOrigin(): RevealOrigin {
  if (lastPointer !== undefined && performance.now() - lastPointer.at < 1500) {
    return lastPointer;
  }
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) {
    const rect = active.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 3 };
}
