"use client";

import { useCallback } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { densityAttributes, ThemeScope } from "@elmeragroup/fuse/theme";

import { metricStyle } from "../../lib/studio/density-metrics";
import { metricOverridesFor } from "../../lib/studio/edits";
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
    chrome: "pointer-events-none absolute inset-0 z-10",
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

export type StudioArtboardProps = {
  /** The artboard's id in the page's document (`src/lib/studio/documents.ts`). */
  id: string;
  children: ReactNode;
};

/**
 * One artboard: a theme scope in the studio's base theme, in its own scheme and density, with
 * its name above it at a constant screen size. It carries `data-demo-stage` and the density
 * attributes, the docs' demo-stage density mechanism, so each artboard has its own metrics, and
 * the overlays opened inside it portal into it. The token edits for its scheme and the metric
 * edits for its density are inline declarations on the scope element itself, where the theme
 * rules resolve their aliases and every part inside inherits the metrics.
 */
export function StudioArtboard({ id, children }: StudioArtboardProps): ReactElement {
  const { artboards, theme, settingsOf, selectedId, hoveredId, select } = useStudio();
  const { styleFor, overrides } = useStudioEdits();
  const { registerArtboard } = useViewportCommands();
  const spec = artboards.find((artboard) => artboard.id === id);
  if (spec === undefined) {
    throw new Error(`${id} is not an artboard of this studio page (src/lib/studio/documents.ts)`);
  }
  const settings = settingsOf(spec);
  const scopeStyle = () => ({
    ...styleFor(settings.scheme),
    ...metricStyle(metricOverridesFor(overrides, settings.density)),
  });
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
        theme={theme}
        data-theme={settings.scheme}
        data-demo-stage
        {...densityAttributes(settings.density)}
        // oxlint-disable-next-line shadcn/no-inline-styles -- token and metric edits: custom properties only (artboardStyle, metricStyle), declared on the scope element so its aliases resolve against them
        style={scopeStyle()}
        role="region"
        aria-label={spec.name}
        // The Layers list hands keyboard focus here; Tab then continues through its content.
        tabIndex={-1}
        className={styles.board()}>
        {children}
      </ThemeScope>
    </div>
  );
}
