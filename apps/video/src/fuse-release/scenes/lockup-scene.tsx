import type { ReactElement } from "react";

import { Interactive, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { Badge } from "@elmeragroup/fuse/badge";
import { ElmeraGroupLogo } from "@elmeragroup/fuse/icons";

import { DEFAULT_VERSION } from "../../brand/fuse-facts";
import { useCopy } from "../../copy/copy";
import { CLAMP } from "../../motion/easing";
import { bars, beats } from "../../music/beat-grid";
import { Rise } from "../../primitives/rise";
import { SceneFrame } from "../../primitives/scene-frame";
import { SceneTheme } from "../../primitives/scene-theme";

/** Props for the lockup: the version it announces. */
type LockupProps = {
  readonly version: string;
};

function LockupSceneInner({ version }: LockupProps): ReactElement {
  const { lockup } = useCopy();
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const pop = spring({ fps, frame: frame - bars(1), config: { damping: 14, stiffness: 180, mass: 0.7 } });

  return (
    <SceneFrame>
      <SceneTheme
        brand="elma"
        scheme="dark"
        className="flex size-full items-center justify-center bg-background font-sans text-foreground">
        {/* The lockup holds over the track's ending, so it drifts closer the whole time instead of freezing. */}
        <div
          className="flex flex-col items-center gap-7"
          style={{ scale: String(interpolate(frame, [0, durationInFrames], [1, 1.04], CLAMP)) }}>
          <Rise at={0} distance={32} className="flex items-center gap-7">
            {/* The site's lockup: the Elmera mark beside the Fuse wordmark, as in the landing nav. */}
            <ElmeraGroupLogo variant="mark" className="h-24 w-auto" aria-hidden />
            <span className="font-semibold font-heading text-[120px] leading-none tracking-[-0.03em]">
              Fuse
            </span>
            <span
              style={{
                opacity: interpolate(frame, [bars(1), bars(1) + 4], [0, 1], CLAMP),
                scale: String(0.6 + 0.4 * pop),
              }}>
              <Badge variant="secondary" className="px-4 py-1.5 font-mono text-[28px]">
                {version}
              </Badge>
            </span>
          </Rise>
          <Rise at={bars(1) + beats(2)}>
            <p className="m-0 text-[22px] text-muted-foreground">{lockup.caption}</p>
          </Rise>
        </div>
      </SceneTheme>
    </SceneFrame>
  );
}

/** Scene 6: the Elmera mark, the Fuse wordmark and the version, over the track's closing bars. */
export const LockupScene = Interactive.withSchema({
  Component: LockupSceneInner,
  componentName: "LockupScene",
  schema: {
    version: { type: "string", default: DEFAULT_VERSION, description: "Version" },
  },
  wrapInSequence: true,
  layout: "absolute-fill",
});
