import type { ReactElement } from "react";

import { Interactive, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { Badge } from "@elmeragroup/fuse/badge";
import { ElmeraGroupLogo } from "@elmeragroup/fuse/icons";

import { DEFAULT_VERSION, INSTALL_COMMAND } from "../brand/fuse-facts";
import { Typewriter } from "../components/remocn/typewriter";
import { useCopy } from "../copy/copy";
import { CLAMP } from "../motion/easing";
import { bars, beats } from "../music/beat-grid";
import { Rise } from "../primitives/rise";
import { SceneFrame } from "../primitives/scene-frame";
import { SceneTheme } from "../primitives/scene-theme";

/** Props for the lockup: the version it announces. */
type LockupProps = {
  readonly version: string;
};

function LockupSceneInner({ version }: LockupProps): ReactElement {
  const { lockup } = useCopy().claudeBuilds;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const pop = spring({ fps, frame: frame - beats(2), config: { damping: 14, stiffness: 180, mass: 0.7 } });

  return (
    <SceneFrame>
      <SceneTheme
        brand="elma"
        scheme="dark"
        className="flex size-full items-center justify-center bg-background font-sans text-foreground">
        {/* The lockup holds over the track's last notes, so it drifts closer instead of freezing. */}
        <div
          className="flex flex-col items-center gap-9"
          style={{ scale: String(interpolate(frame, [0, durationInFrames], [1, 1.035], CLAMP)) }}>
          <Rise at={0} distance={32} className="flex items-center gap-7">
            <ElmeraGroupLogo variant="mark" className="h-22 w-auto" aria-hidden />
            <span className="font-semibold font-heading text-[112px] leading-none tracking-[-0.03em]">
              Fuse
            </span>
            <span
              style={{
                opacity: interpolate(frame, [beats(2), beats(2) + 4], [0, 1], CLAMP),
                scale: String(0.6 + 0.4 * pop),
              }}>
              <Badge variant="secondary" className="font-bold px-4 py-1.5 font-mono text-[26px]">
                {version}
              </Badge>
            </span>
          </Rise>
          <Rise at={beats(3)}>
            <div className="flex h-14 w-120 items-center gap-3 rounded-xl border border-border bg-card px-5 font-mono text-[22px] text-card-foreground">
              <span className="text-muted-foreground">{">"}</span>
              <Typewriter text={INSTALL_COMMAND} startAt={beats(4)} className="min-w-0 flex-1" />
            </div>
          </Rise>
          <Rise at={bars(2)}>
            <p className="m-0 text-[22px] text-muted-foreground">{lockup.caption}</p>
          </Rise>
        </div>
      </SceneTheme>
    </SceneFrame>
  );
}

/** Scene 2: the Elmera mark, the Fuse wordmark and the version over the install command. */
export const LockupScene = Interactive.withSchema({
  Component: LockupSceneInner,
  componentName: "ClaudeBuildsLockupScene",
  schema: {
    version: { type: "string", default: DEFAULT_VERSION, description: "Version" },
  },
  wrapInSequence: true,
  layout: "absolute-fill",
});
