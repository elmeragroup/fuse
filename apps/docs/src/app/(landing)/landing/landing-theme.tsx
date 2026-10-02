"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { flushSync } from "react-dom";

import * as CssColor from "@elmeragroup/color/css-color";
import * as Hex from "@elmeragroup/color/hex";
import { coerceTheme, LocaleProvider, ThemeProvider, useColorScheme } from "@elmeragroup/fuse/theme";
import type { ColorScheme, ThemeInput } from "@elmeragroup/fuse/theme";

import { DOCUMENT_COLOR_SCHEME } from "../../../lib/theme";
import { LANDING_THEME } from "./landing-theme-defaults";

/** Where a re-theme was triggered, so the reveal can grow out of the finger or cursor. */
export type RevealOrigin = { x: number; y: number };

type AxisChange = Partial<{
  variant: ThemeInput["variant"];
  brand: ThemeInput["brand"];
  segment: ThemeInput["segment"];
}>;

type LandingThemeValue = {
  theme: ThemeInput;
  /** Moves one or more theme axes; a pinned brand drags its segment along through `coerceTheme`. */
  changeTheme: (change: AxisChange, origin?: RevealOrigin) => void;
  changeColorScheme: (scheme: ColorScheme, origin?: RevealOrigin) => void;
  colorScheme: ColorScheme;
};

const LandingThemeContext = createContext<LandingThemeValue | undefined>(undefined);

const REVEAL_MS = 560;
const REVEAL_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * Runs a DOM-changing update under a circular view-transition reveal centred on `origin`.
 *
 * A re-theme is rare and deliberate, so it earns a longer, explanatory animation than a
 * control would. Reduced motion and browsers without view transitions get the instant swap.
 */
function revealUpdate(update: () => void, origin: RevealOrigin | undefined): void {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!("startViewTransition" in document) || reduce) {
    update();
    return;
  }
  const { x, y } = origin ?? resolveOrigin();
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

  const changeTheme = useCallback(
    (change: AxisChange, origin?: RevealOrigin) => {
      const next = coerceTheme({ ...theme, ...change });
      if (next === null) {
        return;
      }
      if (next.variant === theme.variant && next.brand === theme.brand && next.segment === theme.segment) {
        return;
      }
      revealUpdate(() => setTheme(next), origin);
    },
    [theme, setTheme]
  );

  const changeColorScheme = useCallback(
    (next: ColorScheme, origin?: RevealOrigin) => {
      if (next === colorScheme) {
        return;
      }
      revealUpdate(() => setColorScheme(next), origin);
    },
    [colorScheme, setColorScheme]
  );

  usePointerOrigin();
  useStatusBarColor(theme, resolvedColorScheme);

  const value = useMemo(
    (): LandingThemeValue => ({
      theme,
      changeTheme,
      changeColorScheme,
      colorScheme,
    }),
    [theme, changeTheme, changeColorScheme, colorScheme]
  );

  return <LandingThemeContext.Provider value={value}>{children}</LandingThemeContext.Provider>;
}

/**
 * Points both `theme-color` tags at the live `--background`, so the phone's status bar and
 * browser chrome match the top of the page in whichever brand and scheme it wears.
 */
function useStatusBarColor(theme: ThemeInput, scheme: string | undefined): void {
  useEffect(() => {
    const computed = window.getComputedStyle(document.body).backgroundColor;
    const parsed = CssColor.parse(computed);
    if (parsed._tag === "err") {
      return;
    }
    const hex = Hex.formatOpaque(CssColor.toSrgb(parsed.value));
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
