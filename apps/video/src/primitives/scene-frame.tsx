import type { ReactElement, ReactNode } from "react";

import { useDelayRender } from "remotion";

import { LocaleProvider } from "@elmeragroup/fuse/theme";

import { useVideoLocale } from "../copy/copy";
import { useFrameClock } from "../motion/frame-clock";
import type { FrameClock, RenderHold } from "../motion/frame-clock";
import { SeekCssAnimations } from "../motion/seek-css-animations";
import { FontGate, loadVideoFonts } from "./font-gate";
import { Stage } from "./stage";

/** Props for {@link ReadyFrame}. */
export type ReadyFrameProps = {
  readonly clock: FrameClock;
  readonly hold: RenderHold;
  /** Loads the faces; the video's faces by default. */
  readonly loadFonts?: () => Promise<void>;
  readonly children: ReactNode;
};

/**
 * A scene's readiness: its content and the seek helper mount together behind the font gate, so
 * the frame is held from the first render until the faces have loaded, the content has
 * committed and its motion has settled.
 *
 * @returns The gated content and its seek helper.
 */
export function ReadyFrame({
  clock,
  hold,
  loadFonts = loadVideoFonts,
  children,
}: ReadyFrameProps): ReactElement {
  return (
    <FontGate hold={hold} load={loadFonts}>
      {children}
      <SeekCssAnimations clock={clock} hold={hold} />
    </FontGate>
  );
}

/** Props for {@link SceneFrame}. */
export type SceneFrameProps = {
  /** The scene, laid out on the 1280×720 stage. */
  readonly children: ReactNode;
};

/**
 * The frame every scene renders in: Fuse's locale, the scaled stage and the scene's readiness. A
 * scene owns its frame, so it renders the same inside its film and opened on its own in Studio,
 * and only one seek helper runs per mounted scene.
 *
 * @returns The framed scene.
 */
export function SceneFrame({ children }: SceneFrameProps): ReactElement {
  const locale = useVideoLocale();
  const clock = useFrameClock();
  const hold: RenderHold = useDelayRender();
  return (
    <LocaleProvider locale={locale}>
      <Stage>
        <ReadyFrame clock={clock} hold={hold}>
          {children}
        </ReadyFrame>
      </Stage>
    </LocaleProvider>
  );
}
