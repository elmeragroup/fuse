import type { ReactElement } from "react";

import { Interactive, useVideoConfig } from "remotion";

import { MaskRevealUp } from "../../components/remocn/mask-reveal-up";
import { useCopy } from "../../copy/copy";
import { bars, beats } from "../../music/beat-grid";
import { BrandHeatmap } from "../../primitives/brand-heatmap";
import { FittedHeadline } from "../../primitives/fitted-headline";
import { Rise } from "../../primitives/rise";
import { SceneFrame } from "../../primitives/scene-frame";
import { SceneTheme } from "../../primitives/scene-theme";

/** The headline's slot on the stage: clear of the heatmap's mark in the longest locale. */
const HEADLINE_WIDTH = 600;

function HeroSceneInner(): ReactElement {
  const { hero } = useCopy();
  const { durationInFrames } = useVideoConfig();
  // Everything lifts out over the scene's last beat.
  const exitAt = durationInFrames - beats(1);

  return (
    <SceneFrame>
      <SceneTheme
        brand="elma"
        scheme="dark"
        className="relative size-full overflow-hidden bg-background font-sans text-foreground">
        <BrandHeatmap scheme="dark" className="absolute top-0 -right-32 h-full w-205" />
        <div className="absolute inset-y-0 left-0 w-190 bg-linear-to-r from-background from-55% to-transparent" />
        <div className="absolute top-0 left-24 flex h-full flex-col justify-center gap-6">
          <Rise at={beats(1)} exitAt={exitAt}>
            <p className="text-sm m-0 font-mono tracking-[0.12em] text-secondary uppercase">{hero.eyebrow}</p>
          </Rise>
          {/* Both rows hold their place from the first frame, so the centred group never reflows. */}
          <FittedHeadline
            lines={[hero.lead, hero.accent]}
            width={HEADLINE_WIDTH}
            maxSize={96}
            className="font-heading">
            <MaskRevealUp
              lines={[
                { text: hero.lead, at: beats(2) },
                { text: hero.accent, at: bars(1), className: "text-secondary" },
              ]}
              exitAt={exitAt}
            />
          </FittedHeadline>
        </div>
      </SceneTheme>
    </SceneFrame>
  );
}

/** Scene 1: "One system. Every brand." over the Elmera heatmap, in the dark scheme. */
export const HeroScene = Interactive.withSchema({
  Component: HeroSceneInner,
  componentName: "HeroScene",
  schema: {},
  wrapInSequence: true,
  layout: "absolute-fill",
});
