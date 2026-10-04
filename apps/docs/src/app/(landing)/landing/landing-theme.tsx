"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { useSearchParams } from "next/navigation";
import { flushSync } from "react-dom";

import * as CssColor from "@elmeragroup/color/css-color";
import * as Hex from "@elmeragroup/color/hex";
import type * as Srgb from "@elmeragroup/color/srgb";
import {
  coerceTheme,
  LocaleProvider,
  ThemeProvider,
  themeSlug,
  useColorScheme,
} from "@elmeragroup/fuse/theme";
import type { BrandCode, ColorScheme, ThemeInput, ThemeSegment, ThemeVariant } from "@elmeragroup/fuse/theme";

import { DOCUMENT_COLOR_SCHEME } from "../../../lib/theme";
import { LANDING_THEME, parseThemeQuery, sameTheme, THEME_QUERY } from "./landing-theme-defaults";
import { themeAnnouncement } from "./theme-picker/theme-options";

/** Where a re-theme was triggered, so the reveal can grow out of the finger or cursor. */
type RevealOrigin = { x: number; y: number };

/** The axes one control moves; the rest keep their values. */
export type ThemeChange = {
  readonly variant?: ThemeVariant;
  readonly brand?: BrandCode;
  readonly segment?: ThemeSegment;
};

type LandingThemeValue = {
  /** The theme the document wears, and the hero window's side through its variant. */
  theme: ThemeInput;
  /**
   * Moves one or more axes under the circle reveal and announces the result. A brand pinned to one
   * segment drags the segment along through `coerceTheme`.
   */
  changeTheme: (change: ThemeChange) => void;
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
  /** The theme the server read from the request's `?theme=`, which the first paint wears. */
  routeTheme: ThemeInput;
  children: ReactNode;
};

/**
 * Owns the landing's theme and colour scheme. It writes only the `data-theme-*` attributes:
 * `data-density` stays as the layout stamped it from `LANDING_THEME`, so the internal variant keeps
 * the landing's comfortable metrics. Hosts own density (AGENTS.md), and a density change would
 * reflow the whole page under the visitor's cursor.
 */
export function LandingThemeProvider({ routeTheme, children }: LandingThemeProviderProps): ReactElement {
  const [theme, setTheme] = useState<ThemeInput>(routeTheme);
  // Next keeps client state across a navigation that changes only the query, and Back restores
  // a picked entry with the page props it was first rendered with. So the landing wears whatever
  // `?theme=` the address bar moves to, through a link, Back or Forward. A pick's own
  // `replaceState` moves it to the theme already worn, and remounts nothing. Every value is read,
  // in the shape Next gives the server's `searchParams`, so a repeated `theme` opens on the
  // default here as it does on a fresh load. The comparison covers every value, so a second
  // `theme` added after an unchanged first still counts as a change.
  const values = useSearchParams().getAll(THEME_QUERY);
  const query = JSON.stringify(values);
  const [seenQuery, setSeenQuery] = useState(query);
  if (seenQuery !== query) {
    setSeenQuery(query);
    setTheme(parseThemeQuery(values.length > 1 ? values : values[0]));
  }

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
  const [announcement, setAnnouncement] = useState("");

  const changeTheme = useCallback(
    (change: ThemeChange) => {
      const next = coerceTheme({ ...theme, ...change });
      if (next === null || sameTheme(next, theme)) {
        return;
      }
      revealUpdate(() => {
        setTheme(next);
        setAnnouncement(themeAnnouncement(next, colorScheme));
      });
    },
    [theme, setTheme, colorScheme]
  );

  const changeColorScheme = useCallback(
    (next: ColorScheme) => {
      if (next === colorScheme) {
        return;
      }
      revealUpdate(() => {
        setColorScheme(next);
        setAnnouncement(themeAnnouncement(theme, next));
      });
    },
    [theme, colorScheme, setColorScheme]
  );

  usePointerOrigin();
  useStatusBarColor(theme, resolvedColorScheme);
  useThemeQuery(theme);

  const value = useMemo(
    (): LandingThemeValue => ({
      theme,
      changeTheme,
      changeColorScheme,
      colorScheme,
    }),
    [theme, changeTheme, changeColorScheme, colorScheme]
  );

  return (
    <LandingThemeContext.Provider value={value}>
      {children}
      {/* `role="status"` is polite already; the explicit attribute is what a modal's hiding
          exempts, so the phone's Sheet leaves the announcements audible. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </LandingThemeContext.Provider>
  );
}

/**
 * Mirrors the theme in the address bar, so a visitor can share what they are looking at. It
 * replaces the entry rather than pushing one, so Back leaves the page instead of stepping through
 * every pick, and it keeps every other parameter. The opening theme drops the
 * parameter, so the plain address stays plain.
 */
function useThemeQuery(theme: ThemeInput): void {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (sameTheme(theme, LANDING_THEME)) {
      url.searchParams.delete(THEME_QUERY);
    } else {
      url.searchParams.set(THEME_QUERY, themeSlug(theme));
    }
    if (url.href !== window.location.href) {
      // No state of its own: Next then copies its router state into the entry and moves
      // `useSearchParams` to the new address, so Back to this entry restores the picked theme.
      // Handing over `window.history.state` would carry Next's marker and skip that sync.
      window.history.replaceState(null, "", url);
    }
  }, [theme]);
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
