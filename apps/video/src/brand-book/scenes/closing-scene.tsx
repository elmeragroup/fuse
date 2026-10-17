import { useRef } from "react";
import type { ReactElement, ReactNode } from "react";

import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { Badge } from "@elmeragroup/fuse/badge";
import { ElmeraGroupLogo } from "@elmeragroup/fuse/icons";
import type { BrandCode } from "@elmeragroup/fuse/theme";

import { DEFAULT_VERSION, SITE } from "../../brand/fuse-facts";
import { useCopy } from "../../copy/copy";
import { CLAMP, ENTER, EXIT } from "../../motion/easing";
import { bars, beats } from "../../music/beat-grid";
import { Rise } from "../../primitives/rise";
import { SceneFrame } from "../../primitives/scene-frame";
import { SceneTheme } from "../../primitives/scene-theme";
import { STAGE, useStageBox } from "../../primitives/stage";
import { push } from "../motion";

/** The brands whose own colour fills each tile's block before it flips: three of the seven. */
const TILE_BRANDS = ["fkas", "tkas", "fkse"] as const satisfies readonly BrandCode[];

/** Frames a tile takes to flip over, and the frames between neighbouring flips. */
const FLIP_FRAMES = 12;
const FLIP_STAGGER = 3;

/** How far a block bobs before it flips, in stage pixels: the template's lift at this stage. */
const BOB = 22;

/** When things happen, in the closing's own frames. */
const FLIP_AT = beats(3);
const WORDS_OUT_AT = bars(2.5);
const LOCKUP_AT = bars(2.75);
const NAME_OUT_AT = bars(4.75);
const FOOTER_AT = bars(5);

/**
 * One of the template's flipping tiles: a block in a brand's own colour bobs, then turns over on the
 * X axis to show its face. The face sizes the tile, so the block covers exactly what it hides.
 */
function FlipTile({
  index,
  brand,
  frame,
  children,
}: {
  readonly index: number;
  readonly brand: BrandCode;
  readonly frame: number;
  readonly children: ReactNode;
}): ReactElement {
  const start = FLIP_AT + index * FLIP_STAGGER;
  const turn = push(frame, start, start + FLIP_FRAMES);
  const bob = Math.sin((frame / FLIP_AT) * Math.PI * 2 + index * 1.1) * (1 - turn) * BOB;
  const gone = interpolate(frame, [WORDS_OUT_AT + index * 2, WORDS_OUT_AT + index * 2 + 10], [0, 1], {
    ...CLAMP,
    easing: EXIT,
  });
  return (
    <div
      className="relative perspective-[600px]"
      style={{ translate: `0 ${String(bob - gone * 24)}px`, opacity: 1 - gone }}>
      <div
        style={{
          visibility: turn < 0.5 ? "hidden" : "visible",
          rotate: `x ${String(-180 * (1 - turn))}deg`,
        }}>
        {children}
      </div>
      {/* The block turns away over the first half of the flip; the face turns in over the second. */}
      {turn < 0.5 ? (
        <div className="absolute inset-x-0 inset-y-2" style={{ rotate: `x ${String(180 * turn)}deg` }}>
          <SceneTheme brand={brand} scheme="dark" className="size-full bg-brand">
            {null}
          </SceneTheme>
        </div>
      ) : null}
    </div>
  );
}

/** The close itself; it measures the lockup, so it renders inside the scene's font gate. */
function ClosingPage({ version }: { readonly version: string }): ReactElement {
  const { closing } = useCopy().brandBook;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const spacer = useRef<HTMLSpanElement>(null);
  const slot = useStageBox(spacer);
  const [first, second] = closing.words;
  const nameOut = push(frame, NAME_OUT_AT, NAME_OUT_AT + beats(2));
  const lockupIn = interpolate(frame, [LOCKUP_AT, LOCKUP_AT + 14], [0, 1], { ...CLAMP, easing: ENTER });
  // The mark sits in the lockup's slot, then moves to the stage's centre as the name leaves.
  const markX = slot === null ? 0 : slot.x + (STAGE.width / 2 - slot.width / 2 - slot.x) * nameOut;

  return (
    <SceneTheme
      brand="elma"
      scheme="dark"
      className="relative size-full overflow-hidden bg-background font-sans text-foreground">
      <div
        className="absolute inset-0"
        style={{ scale: String(interpolate(frame, [0, durationInFrames], [1, 1.03], CLAMP)) }}>
        {frame < LOCKUP_AT + 10 ? (
          <div className="absolute inset-0 flex items-center justify-center gap-12">
            <FlipTile index={0} brand={TILE_BRANDS[0]} frame={frame}>
              <p className="font-semibold leading-tight m-0 font-heading text-[64px] tracking-[-0.03em]">
                {first}
              </p>
            </FlipTile>
            <FlipTile index={1} brand={TILE_BRANDS[1]} frame={frame}>
              <p className="font-semibold leading-tight m-0 font-heading text-[64px] tracking-[-0.03em]">
                {second}
              </p>
            </FlipTile>
            <FlipTile index={2} brand={TILE_BRANDS[2]} frame={frame}>
              <ElmeraGroupLogo variant="mark" aria-hidden className="my-3 h-16 w-auto" />
            </FlipTile>
          </div>
        ) : null}
        <div
          className="absolute inset-0 flex items-center justify-center gap-7"
          style={{ opacity: lockupIn, scale: String(0.94 + 0.06 * lockupIn) }}>
          <span ref={spacer} className="h-24 w-22 shrink-0" />
          <span
            className="font-semibold font-heading text-[120px] leading-none tracking-[-0.03em]"
            style={{ opacity: 1 - nameOut, translate: `0 ${String(-12 * nameOut)}px` }}>
            Fuse
          </span>
          <span style={{ opacity: 1 - nameOut }}>
            <Badge variant="secondary" className="px-4 py-1.5 font-mono text-[28px]">
              {version}
            </Badge>
          </span>
        </div>
        {slot === null ? null : (
          <ElmeraGroupLogo
            variant="mark"
            aria-hidden
            className="absolute"
            style={{
              left: 0,
              top: slot.y,
              width: slot.width,
              height: slot.height,
              translate: `${String(markX)}px 0`,
              opacity: lockupIn,
            }}
          />
        )}
        <div className="absolute inset-x-0 bottom-16 flex flex-col items-center gap-2 text-center">
          <Rise at={FOOTER_AT}>
            <p className="text-lg m-0 text-muted-foreground">{closing.caption}</p>
          </Rise>
          <Rise at={FOOTER_AT + beats(2)}>
            <p className="text-lg font-medium m-0 text-secondary">{SITE}</p>
          </Rise>
        </div>
      </div>
    </SceneTheme>
  );
}

function ClosingSceneInner({ version }: { readonly version: string }): ReactElement {
  return (
    <SceneFrame>
      <ClosingPage version={version} />
    </SceneFrame>
  );
}

/**
 * Scene 5: the close, over the track's ending. Three blocks in three brands' colours bob and
 * flip to "One system.", "Every brand." and the Elmera mark; the Fuse lockup resolves, then the
 * name lifts away and the mark settles alone, as the template resolves back to its mark.
 */
export const ClosingScene = Interactive.withSchema({
  Component: ClosingSceneInner,
  componentName: "ClosingScene",
  schema: {
    version: { type: "string", default: DEFAULT_VERSION, description: "Version" },
  },
  wrapInSequence: true,
  layout: "absolute-fill",
});
