import type { ReactElement } from "react";

import { Interactive } from "remotion";

import { VERSION_SCHEMA } from "../../brand/fuse-facts";
import { useCopy } from "../../copy/copy";
import { bars, beats } from "../../music/beat-grid";
import { FuseLockup, useDriftCloser } from "../../primitives/fuse-lockup";
import { Rise } from "../../primitives/rise";
import { SceneFrame } from "../../primitives/scene-frame";
import { SceneTheme } from "../../primitives/scene-theme";

/** Props for the lockup: the version it announces. */
type LockupProps = {
  readonly version: string;
};

function LockupSceneInner({ version }: LockupProps): ReactElement {
  const { lockup } = useCopy();
  const scale = useDriftCloser(1.04);

  return (
    <SceneFrame>
      <SceneTheme
        brand="elma"
        scheme="dark"
        className="flex size-full items-center justify-center bg-background font-sans text-foreground">
        <div className="flex flex-col items-center gap-7" style={{ scale }}>
          <Rise at={0} distance={32}>
            <FuseLockup version={version} size="large" popAt={bars(1)} />
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
  schema: VERSION_SCHEMA,
  wrapInSequence: true,
  layout: "absolute-fill",
});
