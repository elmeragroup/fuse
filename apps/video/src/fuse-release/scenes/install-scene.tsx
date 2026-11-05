import type { ReactElement } from "react";

import { Interactive, Sequence, useVideoConfig } from "remotion";

import { Button } from "@elmeragroup/fuse/button";

import { INSTALL_COMMAND, SITE } from "../../brand/fuse-facts";
import { MaskRevealUp } from "../../components/remocn/mask-reveal-up";
import { Typewriter } from "../../components/remocn/typewriter";
import { useCopy } from "../../copy/copy";
import { bars, beats } from "../../music/beat-grid";
import { BrandHeatmap } from "../../primitives/brand-heatmap";
import { FittedHeadline } from "../../primitives/fitted-headline";
import { Rise } from "../../primitives/rise";
import { SceneFrame } from "../../primitives/scene-frame";
import { SceneTheme } from "../../primitives/scene-theme";

/** The copy column's width on the stage. */
const COLUMN_WIDTH = 620;

function InstallSceneInner(): ReactElement {
  const { install } = useCopy();
  const { durationInFrames } = useVideoConfig();
  const exitAt = durationInFrames - beats(1);

  return (
    <SceneFrame>
      <SceneTheme
        brand="elma"
        scheme="light"
        className="relative size-full overflow-hidden bg-background font-sans text-foreground">
        <BrandHeatmap scheme="light" className="absolute top-0 -right-16 h-full w-205" />
        <div className="absolute inset-y-0 left-0 w-190 bg-linear-to-r from-background from-55% to-transparent" />
        <div
          className="absolute top-0 left-24 flex h-full flex-col justify-center gap-6"
          style={{ width: COLUMN_WIDTH }}>
          <FittedHeadline lines={[install.title]} width={COLUMN_WIDTH} maxSize={84} className="font-heading">
            <MaskRevealUp lines={[{ text: install.title }]} exitAt={exitAt} />
          </FittedHeadline>
          <Rise at={bars(1)} exitAt={exitAt}>
            <p className="leading-relaxed m-0 max-w-125 text-[22px] text-pretty text-muted-foreground">
              {install.lede}
            </p>
          </Rise>
          <Rise at={bars(2)} exitAt={exitAt}>
            <div className="text-lg flex h-(--control-h-lg) w-130 items-center gap-3 rounded-(--radius-button) border border-border bg-card pr-1.5 pl-5 font-mono text-card-foreground">
              <Sequence name="Command" from={bars(2) + beats(2)} layout="none">
                <Typewriter text={INSTALL_COMMAND} className="min-w-0 flex-1" />
              </Sequence>
              <Button size="sm" className="ml-auto">
                {install.copy}
              </Button>
            </div>
          </Rise>
          <Rise at={bars(4)} exitAt={exitAt}>
            <p className="text-xl font-medium m-0 text-secondary">{SITE}</p>
          </Rise>
        </div>
      </SceneTheme>
    </SceneFrame>
  );
}

/**
 * Scene 5: the install command typing itself beside the Elmera heatmap, in the light scheme. Each
 * line arrives on its own bar, so the call to action reads under the outro's drums.
 */
export const InstallScene = Interactive.withSchema({
  Component: InstallSceneInner,
  componentName: "InstallScene",
  schema: {},
  wrapInSequence: true,
  layout: "absolute-fill",
});
