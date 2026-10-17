import type { ReactElement } from "react";

import { Interactive, useCurrentFrame } from "remotion";

import { ElmeraGroupLogo } from "@elmeragroup/fuse/icons";

import { MaskRevealUp } from "../../components/remocn/mask-reveal-up";
import { useCopy } from "../../copy/copy";
import { beats } from "../../music/beat-grid";
import { FittedHeadline } from "../../primitives/fitted-headline";
import { SceneFrame } from "../../primitives/scene-frame";
import { SceneTheme } from "../../primitives/scene-theme";
import { push } from "../motion";

/**
 * The Elmera mark's three strokes, as clip paths over the whole mark: the top bar, the middle bar,
 * and the right column with the bottom bar. Percentages are of the mark's 33 × 37 artwork.
 */
const STROKES = [
  "inset(0 0 78% 0)",
  "inset(38% 40% 40% 0)",
  "polygon(76% 49%, 100% 49%, 100% 100%, 0 100%, 0 78%, 76% 78%)",
] as const;

/** Frames each stroke takes to slide into place. */
const STROKE_FRAMES = 9;

/** How far each stroke slides in from the left, in stage pixels. */
const STROKE_TRAVEL = 36;

/** The tagline's slot on the stage. */
const TAGLINE_WIDTH = 760;

function IdentitySceneInner(): ReactElement {
  const { identity } = useCopy().brandBook;
  const frame = useCurrentFrame();

  return (
    <SceneFrame>
      <SceneTheme
        brand="elma"
        scheme="light"
        className="relative flex size-full flex-col items-center justify-center gap-12 bg-background font-sans text-foreground">
        {/* The template's architectural mark, built stroke by stroke on the pad's first beats. */}
        <div className="relative h-36 w-32 text-primary">
          {STROKES.map((clip, index) => {
            const placed = push(frame, beats(index + 1), beats(index + 1) + STROKE_FRAMES);
            return (
              <ElmeraGroupLogo
                key={clip}
                variant="mark"
                aria-hidden
                className="absolute inset-0 size-full"
                style={{
                  clipPath: clip,
                  opacity: placed,
                  translate: `${String((placed - 1) * STROKE_TRAVEL)}px 0`,
                }}
              />
            );
          })}
        </div>
        <FittedHeadline
          lines={[identity.tagline]}
          width={TAGLINE_WIDTH}
          maxSize={40}
          className="text-center font-heading">
          <MaskRevealUp lines={[{ text: identity.tagline, at: beats(5) }]} />
        </FittedHeadline>
      </SceneTheme>
    </SceneFrame>
  );
}

/** Scene 1: the Elmera mark builds itself on the pad, and the tagline rises under it. */
export const IdentityScene = Interactive.withSchema({
  Component: IdentitySceneInner,
  componentName: "IdentityScene",
  schema: {},
  wrapInSequence: true,
  layout: "absolute-fill",
});
