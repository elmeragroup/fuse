"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import * as CssColor from "@elmeragroup/color/css-color";
import * as Wcag from "@elmeragroup/color/wcag";
import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";

import { pairMark } from "../../../lib/studio/color-roles";
import type { PairMark, RolePair, RoleTile } from "../../../lib/studio/color-roles";
import { canonicalColorCss } from "../../../lib/studio/token-values";
import { useArtboardScope } from "../studio-artboard";
import { useTokenFocus } from "../studio-token-focus";

const pairTile = tv({
  slots: {
    pair: "flex min-w-0 flex-col gap-1.5",
    // The role's fill and its foreground's text, in place of the ghost Button's own colors,
    // hover included, so the swatch shows the pair and nothing else.
    swatch:
      "h-auto min-h-20 w-full flex-col items-start justify-between gap-2 rounded-md border border-border bg-(--pair-fill) p-3 text-start whitespace-normal text-(--pair-text) enabled-hover:bg-(--pair-fill) enabled-hover:text-(--pair-text)",
    name: "text-xs font-mono break-all",
    sample: "text-lg font-medium",
    mark: "self-start",
    // Two hidden spans the browser resolves each color on, through the studio's canonical path.
    probes: "hidden",
    probe: "text-(--probe)",
  },
});

const styles = pairTile();

/** The Badge a mark wears: the status it reports, or a plain outline for a decorative pair. */
function markVariant(state: PairMark["state"]) {
  switch (state) {
    case "pass":
      return "outline-success";
    case "fail":
      return "outline-destructive";
    case "decorative":
      return "outline";
    case "translucent":
      return "outline-warning";
  }
}

function srgbOf(css: string) {
  const parsed = CssColor.parse(css);
  return parsed._tag === "ok" ? CssColor.toSrgb(parsed.value) : undefined;
}

/** The pair's mark from the two probes' computed colors, `undefined` while either is unread. */
function readMark(probes: HTMLElement, grade: RolePair["grade"]): PairMark | undefined {
  const [fill, text] = [...probes.children].map((probe) => srgbOf(getComputedStyle(probe).color));
  if (fill === undefined || text === undefined) {
    return undefined;
  }
  const ratio = Wcag.contrastRatio(text, fill);
  return pairMark(grade, ratio._tag === "ok" ? ratio.value : "translucent");
}

function sameMark(a: PairMark | undefined, b: PairMark | undefined): boolean {
  return a?.state === b?.state && a?.label === b?.label;
}

/**
 * The pair's mark, read off the probes under `probes` after each change to anything the
 * artboard's colors depend on: its theme, scheme, density and token declarations.
 */
function useContrastMark(grade: RolePair["grade"]) {
  const { theme, scheme, density, style } = useArtboardScope();
  const probes = useRef<HTMLSpanElement>(null);
  const [mark, setMark] = useState<PairMark | undefined>(undefined);
  useLayoutEffect(() => {
    const element = probes.current;
    if (element === null) {
      return;
    }
    const next = readMark(element, grade);
    setMark((previous) => (sameMark(previous, next) ? previous : next));
  }, [grade, theme, scheme, density, style]);
  return { probes, mark };
}

/**
 * One role pair: a swatch filled with the role and lettered in its foreground, and the live
 * contrast of the two colors the browser resolved on this artboard. A click selects the role in
 * the inspector, in this artboard's scheme.
 */
function PairSwatch({ pair }: { pair: RolePair }): ReactElement {
  const { focusToken } = useTokenFocus();
  const { scheme } = useArtboardScope();
  const { probes, mark } = useContrastMark(pair.grade);
  return (
    <div className={styles.pair()} data-pair={pair.role}>
      <Button
        variant="ghost"
        className={styles.swatch()}
        style={{ "--pair-fill": `var(--${pair.role})`, "--pair-text": `var(--${pair.foreground})` }}
        aria-label={`--${pair.role}`}
        onClick={() => {
          focusToken(pair.role, scheme);
        }}>
        <span className={styles.name()}>{`--${pair.role}`}</span>
        <span className={styles.sample()}>Aa</span>
        <span className={styles.name()}>{`--${pair.foreground}`}</span>
      </Button>
      {mark === undefined ? null : (
        <Badge
          size="sm"
          variant={markVariant(mark.state)}
          className={styles.mark()}
          data-contrast={mark.state}>
          {mark.label}
        </Badge>
      )}
      <span ref={probes} aria-hidden className={styles.probes()}>
        <span className={styles.probe()} style={{ "--probe": canonicalColorCss(`var(--${pair.role})`) }} />
        <span
          className={styles.probe()}
          style={{ "--probe": canonicalColorCss(`var(--${pair.foreground})`) }}
        />
      </span>
    </div>
  );
}

/**
 * A role's tile: its pair, then its soft form's pair when it has one. The pairs flow into the
 * board's grid, so the soft form takes the cell after its role.
 */
export function PairTile({ tile }: { tile: RoleTile }): ReactElement {
  return (
    <>
      <PairSwatch pair={tile} />
      {tile.soft === undefined ? null : <PairSwatch pair={tile.soft} />}
    </>
  );
}
