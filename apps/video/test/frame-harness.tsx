import { act } from "react";
import type { ReactElement } from "react";

import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

import { settleAnimations } from "../src/motion/seek-css-animations";
import { FPS } from "../src/music/beat-grid";

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
