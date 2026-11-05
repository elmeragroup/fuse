import { act, useMemo } from "react";
import type { ReactElement, ReactNode } from "react";

import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { Internals } from "remotion";

import { LocaleProvider } from "@elmeragroup/fuse/theme";
import type { BrandCode } from "@elmeragroup/fuse/theme";

import { settleAnimations } from "../src/motion/seek-css-animations";
import { FPS } from "../src/music/beat-grid";
import { SceneTheme } from "../src/primitives/scene-theme";

// The browser suites' frame harness: one React root that renders a scene's frames in the order a
// test names, settling Fuse's motion after each as a render does. A suite unmounts it after each
// test with `afterEach(unmountTree)`, and unmounts it mid-test to compare a fresh render of a
// frame with one reached through a history of frames.

let root: Root | undefined;
let container: HTMLDivElement | undefined;

/** Unmounts the tree and removes its element, so the next render mounts fresh. */
export function unmountTree(): void {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
}

/**
 * Renders into a fresh element; later calls before an unmount update the same tree in place.
 *
 * @param node - The tree.
 */
export function render(node: ReactElement): void {
  if (container === undefined) {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  }
  act(() => {
    root?.render(node);
  });
}

/**
 * Renders the frames in order, letting each one settle at its time on the composition clock, as a
 * render does.
 *
 * @param frames - The frames, in the order to render them.
 * @param node - The tree for a frame.
 * @returns Once the last frame has settled.
 */
export async function play(frames: readonly number[], node: (frame: number) => ReactElement): Promise<void> {
  for (const frame of frames) {
    render(node(frame));
    await settleAnimations((frame / FPS) * 1000);
  }
}

/** The composition id the test timeline files its frame under. */
const TEST_COMPOSITION = "test";

/**
 * Remotion's timeline at a frame, so a part that calls `useCurrentFrame` renders in a test, and
 * renders again whenever the frame changes, as it does in a film. With no composition registered,
 * Remotion reads the frame's value as 0; a part that needs the value takes a clock instead.
 *
 * @param props.frame - The frame the timeline stands on.
 * @returns The children on the timeline.
 */
export function Timeline({
  frame,
  children,
}: {
  readonly frame: number;
  readonly children: ReactNode;
}): ReactElement {
  const timeline = useMemo(
    () => ({
      frame: { [TEST_COMPOSITION]: frame },
      isPlaying: () => false,
      isInsideFreeze: false,
      audioAndVideoTags: { current: [] },
    }),
    [frame]
  );
  return (
    <Internals.CanUseRemotionHooksProvider>
      <Internals.TimelineContext value={timeline}>{children}</Internals.TimelineContext>
    </Internals.CanUseRemotionHooksProvider>
  );
}

/** Props for {@link Scope}. */
export type ScopeProps = {
  /** The brand; Elmera Group by default. */
  readonly brand?: BrandCode;
  /** Sizes and places the stage. */
  readonly className?: string;
  readonly children: ReactNode;
};

/**
 * A light external stage in a brand, with Fuse's English locale, as a scene renders its content.
 *
 * @returns The themed stage.
 */
export function Scope({ brand = "elma", className, children }: ScopeProps): ReactElement {
  return (
    <LocaleProvider locale="en-US">
      <SceneTheme brand={brand} scheme="light" className={className}>
        {children}
      </SceneTheme>
    </LocaleProvider>
  );
}
