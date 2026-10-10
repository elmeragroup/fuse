"use client";

import { createContext, use, useCallback, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { usePathname } from "next/navigation";

import type { ColorScheme, Density, ThemeInput, ThemeVariant } from "@elmeragroup/fuse/theme";

import { artboardsFor, pinsFor } from "../../lib/studio/documents";
import type { ArtboardScheme, ArtboardSpec } from "../../lib/studio/documents";
import { OPENING_THEME } from "../../lib/theme";
import { useMediaQuery } from "../../lib/use-media-query";
import { StudioEditsProvider, useEditSession } from "./studio-edits";

/** What a pointer drag on the canvas does: select and use artboard content, or pan. */
export type StudioTool = "select" | "hand";

/** An artboard's editable settings, seeded from its spec. */
export type ArtboardSettings = {
  readonly scheme: ArtboardScheme;
  readonly density: Density;
  /** The variant an artboard that pins one renders; `undefined` follows the base theme. */
  readonly variant: ThemeVariant | undefined;
};

type StudioValue = {
  /** The base theme every artboard renders in. */
  theme: ThemeInput;
  setTheme: (theme: ThemeInput) => void;
  /** The chrome's scheme preference, and what it resolves to now. */
  chromeScheme: ColorScheme;
  resolvedChromeScheme: ArtboardScheme;
  setChromeScheme: (scheme: ColorScheme) => void;
  /** The current page's artboards, in Layers order. */
  artboards: readonly ArtboardSpec[];
  settingsOf: (artboard: ArtboardSpec) => ArtboardSettings;
  changeSettings: (id: string, change: Partial<ArtboardSettings>) => void;
  selectedId: string | undefined;
  select: (id: string | undefined) => void;
  hoveredId: string | undefined;
  hover: (id: string | undefined) => void;
  tool: StudioTool;
  setTool: (tool: StudioTool) => void;
};

const StudioContext = createContext<StudioValue | undefined>(undefined);

/**
 * Owns the studio's editing state. It sits in the studio layout, so the base theme, the token
 * edits and every artboard's settings survive a switch between studio pages. The base theme and
 * the token edits form the edit session (`useStudioEdits`), which the URL hash and an autosave
 * keep; the rest lives in React only.
 */
export function StudioProvider({ children }: { children: ReactNode }): ReactElement {
  const pathname = usePathname();
  const artboards = artboardsFor(pathname);
  const [chromeScheme, setChromeScheme] = useState<ColorScheme>("system");
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)", false);
  const [overrides, setOverrides] = useState<Readonly<Record<string, Partial<ArtboardSettings>>>>({});
  const [selection, setSelection] = useState<{ path: string; id: string } | undefined>(undefined);
  const [hoveredId, hover] = useState<string | undefined>(undefined);
  const [tool, setTool] = useState<StudioTool>("select");

  const settingsOf = useCallback(
    (artboard: ArtboardSpec): ArtboardSettings => ({
      scheme: overrides[artboard.id]?.scheme ?? artboard.scheme,
      density: overrides[artboard.id]?.density ?? artboard.density,
      variant: overrides[artboard.id]?.variant ?? artboard.variant,
    }),
    [overrides]
  );

  const changeSettings = useCallback((id: string, change: Partial<ArtboardSettings>) => {
    setOverrides((current) => ({ ...current, [id]: { ...current[id], ...change } }));
  }, []);

  // A selection belongs to the page it was made on, so a page switch starts with none.
  const selectedId = selection?.path === pathname ? selection.id : undefined;
  const select = useCallback(
    (id: string | undefined) => {
      setSelection(id === undefined ? undefined : { path: pathname, id });
    },
    [pathname]
  );

  const selected = artboards.find((artboard) => artboard.id === selectedId);
  const session = useEditSession(
    OPENING_THEME,
    selectedId,
    selected === undefined ? undefined : settingsOf(selected).scheme,
    pinsFor(pathname)
  );
  const { theme, setTheme } = session;

  const resolvedChromeScheme: ArtboardScheme =
    chromeScheme === "system" ? (prefersDark ? "dark" : "light") : chromeScheme;

  const value = useMemo(
    (): StudioValue => ({
      theme,
      setTheme,
      chromeScheme,
      resolvedChromeScheme,
      setChromeScheme,
      artboards,
      settingsOf,
      changeSettings,
      selectedId,
      select,
      hoveredId,
      hover,
      tool,
      setTool,
    }),
    [
      theme,
      setTheme,
      chromeScheme,
      resolvedChromeScheme,
      artboards,
      settingsOf,
      changeSettings,
      selectedId,
      select,
      hoveredId,
      tool,
      setChromeScheme,
      hover,
      setTool,
    ]
  );

  return (
    <StudioContext.Provider value={value}>
      <StudioEditsProvider value={session.value}>{children}</StudioEditsProvider>
    </StudioContext.Provider>
  );
}

export function useStudio(): StudioValue {
  const value = use(StudioContext);
  if (value === undefined) {
    throw new Error("useStudio must be used within StudioProvider");
  }
  return value;
}
