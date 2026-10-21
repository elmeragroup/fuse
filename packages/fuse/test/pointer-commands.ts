import type { BrowserCommand } from "vitest/node";

/**
 * Browser commands that run in the Vitest server and drive the real mouse through Playwright.
 * `userEvent` has no press-and-hold, so a test cannot read `:active` styles without these, and
 * its hover jumps in one move, so a test cannot glide across a menu the way a hand does.
 * `test/pointer-press.ts` is the only caller.
 */
export const pointerCommands = {
  pointerDown: (async (context) => {
    await context.page.mouse.down();
  }) satisfies BrowserCommand<[]>,
  pointerUp: (async (context) => {
    await context.page.mouse.up();
  }) satisfies BrowserCommand<[]>,
  // The test runs in a frame the runner may scale, so a point in the frame's CSS pixels maps
  // through the frame element's box to the page's.
  pointerGlide: (async (context, x: number, y: number, steps: number) => {
    const frame = await context.frame();
    const box = await (await frame.frameElement()).boundingBox();
    if (box === null) {
      throw new Error("expected the test frame to have a box");
    }
    const width = await frame.evaluate(() => window.innerWidth);
    const scale = box.width / width;
    await context.page.mouse.move(box.x + x * scale, box.y + y * scale, { steps });
  }) satisfies BrowserCommand<[number, number, number]>,
  // A wheel turn where the pointer is, which scrolls whatever a person's wheel would.
  pointerWheel: (async (context, deltaX: number, deltaY: number) => {
    await context.page.mouse.wheel(deltaX, deltaY);
  }) satisfies BrowserCommand<[number, number]>,
};
