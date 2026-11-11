import { beforeAll } from "vitest";
import { cdp, commands, server } from "vitest/browser";

import { nextFrames } from "./animation-frames";

declare module "vitest/browser" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Vitest registers custom commands by interface declaration merging; a type alias cannot augment.
  interface BrowserCommands {
    sizePage: (width: number, height: number) => Promise<void>;
  }
}

/** The CDP call that sizes the page in Chromium. */
type MetricsCdp = {
  readonly send: (
    method: "Emulation.setDeviceMetricsOverride",
    params: {
      readonly width: number;
      readonly height: number;
      readonly deviceScaleFactor: number;
      readonly mobile: boolean;
    }
  ) => Promise<void>;
};

/**
 * Size the page to the test frame through Vitest's CDP session, at a pixel ratio of 1, Playwright's
 * context default, for when a Playwright resize cannot reach the page. Outside Chromium it does
 * nothing.
 */
async function sizePageToFrame(frame: Element): Promise<void> {
  // Vitest hands out a session in every engine, and outside Chromium its calls reject.
  if (server.browser !== "chromium") return;
  // SAFETY: Vitest types its CDP session as {}; Playwright's session implements send.
  const session = cdp() as MetricsCdp;
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: frame.clientWidth,
    height: frame.clientHeight,
    deviceScaleFactor: 1,
    mobile: false,
  });
}

/**
 * How many frames a Playwright resize gets to reach the page before the setup tries CDP. Measured
 * across the browser project, every resize that reached the page did so by the first check.
 */
const PLAYWRIGHT_FRAMES = 2;

/** How many frames the last way of sizing the page gets before the file fails. */
const LAST_FRAMES = 60;

/** Where the test frame falls short of the page's viewport, or null when the page shows all of it. */
function uncovered(): string | null {
  const frame = window.frameElement;
  // A test document that is the page itself has no frame to show.
  if (frame === null) return null;
  const box = frame.getBoundingClientRect();
  const page = window.parent;
  if (box.left >= 0 && box.top >= 0 && box.right <= page.innerWidth && box.bottom <= page.innerHeight)
    return null;
  return `the frame spans ${String(box.left)}, ${String(box.top)} to ${String(box.right)}, ${String(box.bottom)} in a ${String(page.innerWidth)} × ${String(page.innerHeight)} page`;
}

/** Whether the page shows the whole frame within `frames` animation frames. */
async function settles(frames: number): Promise<boolean> {
  for (let frame = 0; frame < frames; frame += 1) {
    if (uncovered() === null) return true;
    await nextFrames(1);
  }
  return uncovered() === null;
}

// Before each file's first test, the page shows the whole frame. A file can start in a page an
// earlier file left at another size, or scrolled, so the frame's far edge falls outside it, where
// Playwright cannot click (see VIEWPORT in vitest.config.ts). The page then scrolls back to its
// start and takes the frame's size from Playwright, which Vitest's own `page.viewport` would skip
// as a size it already set. In Chromium, a file that cleared its own CDP metrics override can leave
// the page at a size no later Playwright call reaches, so the page then takes the frame's size from
// that CDP session. A page that still cuts the frame off fails the file here, before a test reads it.
beforeAll(async () => {
  const frame = window.frameElement;
  if (frame === null || uncovered() === null) return;
  window.parent.scrollTo(0, 0);
  const [width, height] = [frame.clientWidth, frame.clientHeight];
  await commands.sizePage(width, height);
  if (await settles(PLAYWRIGHT_FRAMES)) return;
  await sizePageToFrame(frame);
  if (await settles(LAST_FRAMES)) return;
  throw new Error(`The test page does not show its whole frame: ${uncovered() ?? "it does now"}.`);
});
