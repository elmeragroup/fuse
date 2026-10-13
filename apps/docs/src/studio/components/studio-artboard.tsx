"use client";

import { createContext, use, useCallback, useEffect, useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { densityAttributes, ThemeScope, themeSlug } from "@elmeragroup/fuse/theme";
import type { Density, ThemeInput } from "@elmeragroup/fuse/theme";

import { artboardStyle, otherVariantStyle } from "../lib/artboard-style";
import type { CustomProperties } from "../lib/artboard-style";
import { metricStyle } from "../lib/density-metrics";
import type { ArtboardScheme, ArtboardSpec } from "../lib/documents";
import { metricOverridesFor, resetNames } from "../lib/edits";
import type { StudioOverrides } from "../lib/edits";
import type { StudioSeed } from "../lib/seed";
import { artboardEdits, declarationsOf } from "../lib/token-values";
import type { TokenName } from "../lib/tokens";
import { ChromeScope } from "./chrome-scope";
import { useStudioEdits } from "./studio-edits";
import { useStudio } from "./studio-state";
import { useViewportCommands } from "./studio-viewport";

const studioArtboard = tv({
  slots: {
    // Placed at its world coordinates; its height follows its content.
    // An artboard holding focus, such as one with an open menu, paints over its neighbours.
    root: "absolute top-(--artboard-y) left-(--artboard-x) w-(--artboard-w) focus-within:z-20",
    // A transform makes the artboard the containing block of the fixed overlays that portal
    // into it, so a Dialog's backdrop covers this artboard and its popup centres on it.
    // Focus handed in from the Layers list shows as the selection outline, which it always has.
    board: "shadow-md relative transform-gpu bg-background font-sans text-foreground outline-none",
    // The name and the selection outline, in the chrome's theme, painted over the artboard.
    // Its text color is set here: inherited, it would be the canvas's, not the chrome's.
    chrome: "pointer-events-none absolute inset-0 z-10 text-foreground",
    outline:
      "data-[state=hovered]:studio-ring-hover data-[state=selected]:studio-ring-selected absolute inset-0",
    // Layout only: the label's placement and inverse zoom live here, apart from the Button's
    // own pressed `translate`, so a press never moves it out from under the pointer.
    label: "studio-label pointer-events-auto absolute bottom-full left-0 max-w-(--studio-label-width)",
    button: "max-w-full justify-start",
    name: "truncate",
  },
});

const styles = studioArtboard();

/** What an artboard's content renders in: everything that changes the values it computes. */
export type ArtboardScope = {
  readonly theme: ThemeInput;
  readonly scheme: ArtboardScheme;
  readonly density: Density;
  /** The inline token declarations on the artboard's theme scope. */
  readonly style: CustomProperties;
  /**
   * The token edits the artboard wears: the session's, less those its own theme skips and the
   * step another variant owns. With {@link ArtboardScope.seed} they give each token's declaration
   * there.
   */
  readonly overrides: StudioOverrides;
  /** The seed of the artboard's theme, `undefined` while it loads. */
  readonly seed: StudioSeed | undefined;
  /**
   * The token edits the artboard's own theme skips because they would loop through its aliases,
   * sorted by name. None for an artboard in the base theme, where the edit session admits no loop.
   */
  readonly skipped: readonly TokenName[];
};

const ArtboardScopeContext = createContext<ArtboardScope | undefined>(undefined);

/** The scope of the artboard this content renders in. */
export function useArtboardScope(): ArtboardScope {
  const value = use(ArtboardScopeContext);
  if (value === undefined) {
    throw new Error("useArtboardScope must be used within StudioArtboard");
  }
  return value;
}

/**
 * Whether `theme` is a theme of the artboard's own: one that differs from the base theme in
 * brand, variant or segment, so it needs its own declarations and loop checks.
 */
function ownTheme(theme: ThemeInput, base: ThemeInput): ThemeInput | undefined {
  return themeSlug(theme) === themeSlug(base) ? undefined : theme;
}

/**
 * The scope `spec` renders in, from its settings: the base theme with the edits for its scheme,
 * or the artboard's own theme, with that theme's aliases restated and without the edits that
 * would loop there. The artboard wears it, and the Selection section describes a part by it.
 *
 * @param spec - The artboard, one of the page's.
 */
export function useArtboardScopeOf(spec: ArtboardSpec): ArtboardScope {
  const { theme: base, settingsOf } = useStudio();
  const { overrides, seedOf, requestSeed, styleFor } = useStudioEdits();
  const { scheme, density, theme } = settingsOf(spec);
  const own = ownTheme(theme, base);
  const slug = themeSlug(theme);
  // The edit session loads the seed, and its failure toast retries it.
  useEffect(() => {
    requestSeed(slug);
  }, [requestSeed, slug]);
  const themeSeed = seedOf(slug);
  return useMemo((): ArtboardScope => {
    const metrics = metricStyle(metricOverridesFor(overrides, density));
    if (own === undefined) {
      return {
        theme: base,
        scheme,
        density,
        style: { ...styleFor(scheme), ...metrics },
        overrides,
        seed: themeSeed,
        skipped: [],
      };
    }
    const edits = artboardEdits(overrides, own, scheme);
    const declarations = themeSeed === undefined ? undefined : declarationsOf(themeSeed)[scheme];
    // The variant sets the radius step, so a step edit over the base theme's variant stays off an
    // artboard in the other one. In the base theme's variant, it applies.
    const otherVariant = own.variant !== base.variant;
    return {
      theme: own,
      scheme,
      density,
      style: {
        ...(otherVariant
          ? otherVariantStyle(edits.applied, declarations)
          : artboardStyle(edits.applied, declarations)),
        ...metrics,
      },
      overrides: resetNames(overrides, scheme, [
        ...edits.skipped,
        ...(otherVariant ? ["radius-step" as const] : []),
      ]),
      seed: themeSeed,
      skipped: edits.skipped,
    };
  }, [base, own, themeSeed, scheme, density, overrides, styleFor]);
}

export type StudioArtboardProps = {
  /** The artboard's id in the page's document (`src/studio/lib/documents.ts`). */
  id: string;
  children: ReactNode;
};

/**
 * One artboard: a theme scope in the studio's base theme, in its own scheme and density, with
 * its name above it at a constant screen size. It carries `data-demo-stage` and the density
 * attributes, the docs' demo-stage density mechanism, so each artboard has its own metrics, and
 * the overlays opened inside it portal into it. The token edits for its scheme and the metric
 * edits for its density are inline declarations on the scope element itself, where the theme
 * rules resolve their aliases and every part inside inherits the metrics. An artboard in a theme
 * of its own, the brand, variant and segment the visitor picks or the variant its spec pins,
 * renders that theme with its aliases restated, and skips the edits that would loop there. Its
 * content reads the scope through {@link useArtboardScope}.
 */
export function StudioArtboard({ id, children }: StudioArtboardProps): ReactElement {
  const { artboards, selectedId, hoveredId, select } = useStudio();
  const { registerArtboard } = useViewportCommands();
  const spec = artboards.find((artboard) => artboard.id === id);
  if (spec === undefined) {
    throw new Error(`${id} is not an artboard of this studio page (src/studio/lib/documents.ts)`);
  }
  const scope = useArtboardScopeOf(spec);
  const { scheme, density } = scope;
  const selected = selectedId === id;
  const state = selected ? "selected" : hoveredId === id ? "hovered" : "idle";

  const measure = useCallback(
    (element: HTMLDivElement | null) => (element === null ? undefined : registerArtboard(id, element)),
    [id, registerArtboard]
  );

  const placement: CSSProperties & Record<`--${string}`, string | number> = {
    "--artboard-x": `${String(spec.x)}px`,
    "--artboard-y": `${String(spec.y)}px`,
    "--artboard-w": `${String(spec.width)}px`,
    "--artboard-span": spec.width,
  };

  return (
    <div className={styles.root()} style={placement} data-artboard-id={id}>
      <ChromeScope className={styles.chrome()}>
        <span aria-hidden className={styles.outline()} data-state={state} />
        <div className={styles.label()}>
          <Button
            variant="ghost"
            size="xs"
            className={styles.button()}
            onClick={() => {
              select(id);
            }}>
            <span className={styles.name()}>{spec.name}</span>
          </Button>
        </div>
      </ChromeScope>
      <ThemeScope
        ref={measure}
        theme={scope.theme}
        data-theme={scheme}
        data-demo-stage
        {...densityAttributes(density)}
        // oxlint-disable-next-line shadcn/no-inline-styles -- token and metric edits: custom properties only (artboardStyle, metricStyle), declared on the scope element so its aliases resolve against them
        style={scope.style}
        role="region"
        aria-label={spec.name}
        // The Layers list hands keyboard focus here; Tab then continues through its content.
        tabIndex={-1}
        className={styles.board()}>
        <ArtboardScopeContext.Provider value={scope}>{children}</ArtboardScopeContext.Provider>
      </ThemeScope>
    </div>
  );
}
