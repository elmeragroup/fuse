import type { CDPSession, Page } from "playwright";
import type { BrowserCommand } from "vitest/node";

/** The DevTools session a held finger went down through, which its lift must use too. */
const touches = new WeakMap<Page, CDPSession>();

/**
 * Browser commands that run in the Vitest server and drive the real mouse through Playwright.
 * `userEvent` has no press-and-hold, so a test cannot read `:active` styles without these, and
 * its hover jumps in one move, so a test cannot glide across a menu the way a hand does.
 * `test/pointer-press.ts` calls the mouse commands, and the chart's tap tests call `tap`,
 * `touchStart`, `touchMove` and `touchEnd`.
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
  /**
   * A real tap at a point in the test frame's client coordinates, through Playwright's
   * touchscreen, which needs a context with `hasTouch`. The frame's own offset turns the point
   * into page coordinates.
   */
  tap: (async (context, x: number, y: number) => {
    const frame = await context.iframe.owner().boundingBox();
    await context.page.touchscreen.tap((frame?.x ?? 0) + x, (frame?.y ?? 0) + y);
  }) satisfies BrowserCommand<[number, number]>,
  /**
   * A finger that lands at a point in the test frame's client coordinates and stays down, through
   * Chromium's touch input, so a test can change the page between a touch's start and its lift.
   * Playwright's touchscreen only taps, so this goes through the DevTools protocol.
   */
  touchStart: (async (context, x: number, y: number) => {
    const frame = await context.iframe.owner().boundingBox();
    const session = await context.page.context().newCDPSession(context.page);
    touches.set(context.page, session);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: (frame?.x ?? 0) + x, y: (frame?.y ?? 0) + y }],
    });
  }) satisfies BrowserCommand<[number, number]>,
  /** Moves the finger `touchStart` put down to a point in the test frame's client coordinates. */
  touchMove: (async (context, x: number, y: number) => {
    const session = touches.get(context.page);
    if (session === undefined) {
      throw new Error("expected touchStart to have put a finger down");
    }
    const frame = await context.iframe.owner().boundingBox();
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: (frame?.x ?? 0) + x, y: (frame?.y ?? 0) + y }],
    });
  }) satisfies BrowserCommand<[number, number]>,
  /** Lifts the finger `touchStart` put down, through the session it went down through. */
  touchEnd: (async (context) => {
    const session = touches.get(context.page);
    if (session === undefined) {
      throw new Error("expected touchStart to have put a finger down");
    }
    touches.delete(context.page);
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await session.detach();
  }) satisfies BrowserCommand<[]>,
  /**
   * Several fingers at once, through Chromium's touch input: `points` is every finger down after
   * this event, each by its `id`, in the test frame's client coordinates. A finger missing from
   * the last call's points lifts, a new one lands, and one that moved moves. `touchStart` and
   * `touchMove` dispatch the change; `touchEnd` lifts the fingers left out, and with no points
   * lifts them all and ends the sequence.
   */
  touchPoints: (async (
    context,
    type: "touchStart" | "touchMove" | "touchEnd",
    points: readonly { readonly id: number; readonly x: number; readonly y: number }[]
  ) => {
    const frame = await context.iframe.owner().boundingBox();
    let session = touches.get(context.page);
    if (session === undefined) {
      session = await context.page.context().newCDPSession(context.page);
      touches.set(context.page, session);
    }
    await session.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: points.map((point) => ({
        id: point.id,
        x: (frame?.x ?? 0) + point.x,
        y: (frame?.y ?? 0) + point.y,
      })),
    });
    if (type === "touchEnd" && points.length === 0) {
      touches.delete(context.page);
      await session.detach();
    }
  }) satisfies BrowserCommand<
    [
      "touchStart" | "touchMove" | "touchEnd",
      readonly { readonly id: number; readonly x: number; readonly y: number }[],
    ]
  >,
  /**
   * A finger swipe from a point in the test frame's client coordinates, moving `dx` and `dy` px at
   * `speed` px/s and then lifting, through Chromium's synthetic touch gesture. The gesture runs
   * through the compositor's input path, as a real finger's does, so the page's native scrolling,
   * scroll snapping and the fling after the lift all respond to it. `lift` says whether the finger
   * leaves still moving, which flings, or stops first. It resolves once the gesture's input has
   * been sent; a fling may still be running.
   */
  touchSwipe: (async (
    context,
    x: number,
    y: number,
    dx: number,
    dy: number,
    speed: number,
    lift: "fling" | "hold"
  ) => {
    const frame = await context.iframe.owner().boundingBox();
    const session = await context.page.context().newCDPSession(context.page);
    try {
      await session.send("Input.synthesizeScrollGesture", {
        x: (frame?.x ?? 0) + x,
        y: (frame?.y ?? 0) + y,
        // The protocol's distances are the scroll's: a finger moving left scrolls right.
        xDistance: dx,
        yDistance: dy,
        speed,
        gestureSourceType: "touch",
        preventFling: lift === "hold",
      });
    } finally {
      await session.detach();
    }
  }) satisfies BrowserCommand<[number, number, number, number, number, "fling" | "hold"]>,
};
