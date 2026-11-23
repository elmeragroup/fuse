import type { ReactElement } from "react";

import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import type { BrandCode } from "@elmeragroup/fuse/theme";
import type { ResolvedColorScheme } from "@elmeragroup/fuse/theme-catalog";

import { FILM_BRAND_ORDER } from "../../brand/brand-order";
import { useCopy } from "../../copy/copy";
import { CLAMP, ENTER } from "../../motion/easing";
import { bars, beats } from "../../music/beat-grid";
import { SceneFrame } from "../../primitives/scene-frame";
import { SceneTheme } from "../../primitives/scene-theme";
import { ProductShot } from "./product-shot";

/** One brand's turn: the theme it shows and the bar it arrives on. */
type Turn = {
  readonly brand: BrandCode;
  readonly scheme: ResolvedColorScheme;
  readonly bar: number;
};

/**
 * Every brand in the films' order, one bar each, light and dark alternating. Elmera, first, also
 * holds the opening bar, while the window rises in, so the second brand arrives with the track's
 * drums; the last brand holds the scene's last three bars, while it lifts out.
 */
const TURNS: readonly Turn[] = FILM_BRAND_ORDER.map((brand, index) => ({
  brand,
  scheme: index % 2 === 0 ? "light" : "dark",
  bar: index === 0 ? 0 : index + 1,
}));

/** Frames the circular reveal takes to cover the stage. */
const REVEAL_FRAMES = 12;

/** Where the reveal grows from: the attribute chip, so the new theme spreads out of the attribute. */
const REVEAL_ORIGIN = "250px 640px";

/** The turn on screen at a frame, and the one before it, which the reveal covers. */
type TurnsAtFrame = {
  readonly current: Turn;
  readonly previous: Turn | undefined;
};

/** The turns at a frame. */
function turnsAt(frame: number): TurnsAtFrame {
  const index = TURNS.findLastIndex((turn) => bars(turn.bar) <= frame);
  const current = TURNS[Math.max(index, 0)];
  if (current === undefined) {
    throw new Error("The brand morph has no turns, a defect in TURNS.");
  }
  return { current, previous: index > 0 ? TURNS[index - 1] : undefined };
}

/** The window, the attribute chip and the brand row in one theme. */
function MorphLayer({ turn, frame }: { readonly turn: Turn; readonly frame: number }): ReactElement {
  const { brandMorph } = useCopy();
  const end = useVideoConfig().durationInFrames;
  return (
    <SceneTheme
      brand={turn.brand}
      scheme={turn.scheme}
      className="absolute inset-0 flex flex-col items-center gap-7 bg-background pt-12 font-sans text-foreground">
      <div
        style={{
          opacity: interpolate(frame, [end - beats(1), end], [1, 0], CLAMP),
          translate: `0 ${String(
            interpolate(frame, [0, beats(3)], [60, 0], { ...CLAMP, easing: ENTER }) +
              interpolate(frame, [end - beats(1), end], [0, -40], CLAMP)
          )}px`,
          scale: String(interpolate(frame, [0, beats(3)], [0.96, 1], { ...CLAMP, easing: ENTER })),
        }}>
        <ProductShot brand={turn.brand} />
      </div>
      <div
        className="flex w-230 items-center gap-4"
        style={{
          opacity: interpolate(frame, [beats(2), beats(4), end - beats(1), end], [0, 1, 1, 0], CLAMP),
        }}>
        <code className="text-base rounded-lg border border-border bg-card px-3.5 py-2 font-mono text-card-foreground">
          data-theme-brand="{turn.brand}"
        </code>
        <span className="text-base text-muted-foreground">{brandMorph.caption}</span>
        <span className="ml-auto flex items-center gap-2" aria-hidden>
          {TURNS.map(({ brand }) => (
            <span
              key={brand}
              className={
                brand === turn.brand
                  ? "h-2.5 w-7 rounded-full bg-primary"
                  : "size-2.5 rounded-full bg-muted-foreground/40"
              }
            />
          ))}
        </span>
      </div>
    </SceneTheme>
  );
}

function BrandMorphSceneInner(): ReactElement {
  const frame = useCurrentFrame();
  const { current, previous } = turnsAt(frame);
  const since = frame - bars(current.bar);
  const revealing = previous !== undefined && since < REVEAL_FRAMES;

  return (
    <SceneFrame>
      <div className="relative size-full overflow-hidden">
        {revealing ? (
          <MorphLayer key={`${previous.brand}-${previous.scheme}`} turn={previous} frame={frame} />
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            clipPath: revealing
              ? `circle(${String(interpolate(since, [0, REVEAL_FRAMES], [0, 1500], { ...CLAMP, easing: ENTER }))}px at ${REVEAL_ORIGIN})`
              : undefined,
          }}>
          <MorphLayer key={`${current.brand}-${current.scheme}`} turn={current} frame={frame} />
        </div>
      </div>
    </SceneFrame>
  );
}

/** Scene 2: one customer page through all seven brands, light and dark, on the beat. */
export const BrandMorphScene = Interactive.withSchema({
  Component: BrandMorphSceneInner,
  componentName: "BrandMorphScene",
  schema: {},
  wrapInSequence: true,
  layout: "absolute-fill",
});
