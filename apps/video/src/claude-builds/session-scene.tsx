import type { ReactElement } from "react";

import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { ChatToPreviewLayout } from "../components/remocn/chat-to-preview-layout";
import { CLAMP, EXIT } from "../motion/easing";
import { beats } from "../music/beat-grid";
import { SceneFrame } from "../primitives/scene-frame";
import { MachineTheme } from "./machine-theme";
import { SessionBrowser } from "./session-browser";
import { EXIT_BEATS, MORPHS } from "./session-script";
import { SessionTerminal } from "./session-terminal";

function SessionSceneInner(): ReactElement {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const exitAt = durationInFrames - beats(EXIT_BEATS);
  const leave = interpolate(frame, [exitAt, durationInFrames], [0, 1], { ...CLAMP, easing: EXIT });

  return (
    <SceneFrame>
      <div className="relative size-full overflow-hidden">
        <MachineTheme className="absolute inset-0 bg-background" />
        <div
          className="absolute inset-0"
          style={{
            opacity: 1 - leave,
            scale: String(1 - leave * 0.04),
            filter: `blur(${String(leave * 6)}px)`,
          }}>
          <ChatToPreviewLayout
            morphs={MORPHS}
            chat={(size) => <SessionTerminal size={size} />}
            preview={(size) => <SessionBrowser size={size} />}
          />
        </div>
      </div>
    </SceneFrame>
  );
}

/**
 * Scene 1, one continuous shot: Claude Code takes the prompt, the split opens and the page is
 * built section by section, then flips through every brand into the drop and lands on the stop.
 */
export const SessionScene = Interactive.withSchema({
  Component: SessionSceneInner,
  componentName: "SessionScene",
  schema: {},
  wrapInSequence: true,
  layout: "absolute-fill",
});
