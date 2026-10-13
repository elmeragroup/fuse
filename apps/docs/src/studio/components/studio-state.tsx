"use client";

import { createContext, use, useCallback, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { usePathname } from "next/navigation";

import { themeSlug } from "@elmeragroup/fuse/theme";
import type { ColorScheme, Density, ThemeInput } from "@elmeragroup/fuse/theme";

import { OPENING_THEME } from "../../lib/theme";
import { useMediaQuery } from "../../lib/use-media-query";
import { artboardsFor, pinsFor } from "../lib/documents";
import type { ArtboardScheme, ArtboardSpec } from "../lib/documents";
import { StudioEditsProvider, useEditSession, useSeedFailureToast } from "./studio-edits";

/** What a pointer drag on the canvas does: select and use artboard content, or pan. */
export type StudioTool = "select" | "hand";

/** The selected artboard, on the page it was selected on, and whether its theme toolbar shows. */
type Selection = {
  readonly path: string;
  readonly id: string;
  readonly toolbar: "shown" | "hidden";
};

/** An artboard's editable settings, seeded from its spec. */
export type ArtboardSettings = {
  readonly scheme: ArtboardScheme;
  readonly density: Density;
  /**
   * The theme the artboard renders: its own brand, variant and segment once the visitor picks
   * them, else the base theme with the variant its spec pins. Always a legal theme.
   */
  readonly theme: ThemeInput;
};

/** The settings the visitor changed on one artboard; the rest follow its spec and the base theme. */
type ArtboardChoices = Partial<ArtboardSettings>;

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
  /** An artboard's settings; the same object until they or the base theme change. */
  settingsOf: (artboard: ArtboardSpec) => ArtboardSettings;
  changeSettings: (id: string, change: Partial<ArtboardSettings>) => void;
  selectedId: string | undefined;
  /** Selects an artboard, or clears the selection, and shows the theme toolbar for it. */
  select: (id: string | undefined) => void;
  /** Whether the selected artboard's theme toolbar shows; it hides only on the visitor's toggle. */
  toolbarShown: boolean;
  /** Hides the selected artboard's theme toolbar, or shows it again; the selection stays. */
  toggleToolbar: () => void;
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
  const [choices, setChoices] = useState<Readonly<Record<string, ArtboardChoices>>>({});
  const [selection, setSelection] = useState<Selection | undefined>(undefined);
  const [hoveredId, hover] = useState<string | undefined>(undefined);
  const [tool, setTool] = useState<StudioTool>("select");

  const changeSettings = useCallback(
    (id: string, change: Partial<ArtboardSettings>) => {
      setChoices((current) => ({ ...current, [id]: { ...current[id], ...change } }));
    },
    [setChoices]
  );

  // A selection belongs to the page it was made on, so a page switch starts with none.
  const selectedId = selection?.path === pathname ? selection.id : undefined;
  const select = useCallback(
    (id: string | undefined) => {
      setSelection(id === undefined ? undefined : { path: pathname, id, toolbar: "shown" });
    },
    [pathname]
  );
  const toolbarShown = selectedId !== undefined && selection?.toolbar === "shown";
  const toggleToolbar = useCallback(() => {
    setSelection((current) =>
      current === undefined
        ? undefined
        : { ...current, toolbar: current.toolbar === "shown" ? "hidden" : "shown" }
    );
  }, []);

  const selected = artboards.find((artboard) => artboard.id === selectedId);
  const session = useEditSession(
    OPENING_THEME,
    selectedId,
    selected === undefined ? undefined : (choices[selected.id]?.scheme ?? selected.scheme),
    pinsFor(pathname)
  );
  const { theme, setTheme } = session;

  // Every artboard's own brand, variant and segment are picked against the base theme the
  // visitor sees, so any change of it, by the picker, an undo or redo, a share link or a restore,
  // returns every artboard to it, and a spec-pinned artboard to its spec's variant. Scheme and
  // density stay. Resetting here rather than in the picker's commit catches every source, and an
  // undo does not bring back themes picked against a base theme it left.
  const [themedOver, setThemedOver] = useState(() => themeSlug(theme));
  if (themeSlug(theme) !== themedOver) {
    setThemedOver(themeSlug(theme));
    setChoices((current) =>
      Object.fromEntries(Object.entries(current).map(([id, { theme: _own, ...rest }]) => [id, rest]))
    );
  }

  // One settings object per artboard, so a scope that reads an artboard's theme keeps it until
  // the settings or the base theme change.
  const settings = useMemo(() => {
    const of = (artboard: ArtboardSpec): ArtboardSettings => ({
      scheme: choices[artboard.id]?.scheme ?? artboard.scheme,
      density: choices[artboard.id]?.density ?? artboard.density,
      theme:
        choices[artboard.id]?.theme ??
        (artboard.variant === undefined ? theme : { ...theme, variant: artboard.variant }),
    });
    return { of, byId: new Map(artboards.map((artboard) => [artboard.id, of(artboard)])) };
  }, [artboards, choices, theme]);
  const settingsOf = useCallback(
    (artboard: ArtboardSpec) => settings.byId.get(artboard.id) ?? settings.of(artboard),
    [settings]
  );
  useSeedFailureToast(session.seeds, [
    themeSlug(theme),
    ...Array.from(settings.byId.values(), (artboard) => themeSlug(artboard.theme)),
  ]);

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
      toolbarShown,
      toggleToolbar,
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
      toolbarShown,
      toggleToolbar,
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
