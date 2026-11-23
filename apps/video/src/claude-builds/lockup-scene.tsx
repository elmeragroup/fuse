import type { ReactElement } from "react";

import { Interactive } from "remotion";

import { INSTALL_COMMAND, VERSION_SCHEMA } from "../brand/fuse-facts";
import { Typewriter } from "../components/remocn/typewriter";
import { useCopy } from "../copy/copy";
import { bars, beats } from "../music/beat-grid";
import { FuseLockup, useDriftCloser } from "../primitives/fuse-lockup";
import { Rise } from "../primitives/rise";
import { SceneFrame } from "../primitives/scene-frame";
import { SceneTheme } from "../primitives/scene-theme";

/** Props for the lockup: the version it announces. */
type LockupProps = {
  readonly version: string;
};

function LockupSceneInner({ version }: LockupProps): ReactElement {
  const { lockup } = useCopy().claudeBuilds;
  const scale = useDriftCloser(1.035);

  return (
    <SceneFrame>
      <SceneTheme
        brand="elma"
        scheme="dark"
        className="flex size-full items-center justify-center bg-background font-sans text-foreground">
        <div className="flex flex-col items-center gap-9" style={{ scale }}>
          <Rise at={0} distance={32}>
            <FuseLockup version={version} size="medium" popAt={beats(2)} />
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
  schema: VERSION_SCHEMA,
  wrapInSequence: true,
  layout: "absolute-fill",
});
