import { cdp } from "vitest/browser";

/** One finger on the screen, at a point in the test frame's viewport. */
export type Finger = { readonly x: number; readonly y: number };

/** The fingers on the screen, placed, moved and lifted through Chromium's real touch input. */
export type Touchscreen = {
  /** Puts these fingers down beside the ones already on the screen. */
  readonly place: (fingers: ReadonlyArray<Finger>) => Promise<void>;
  /**
   * Moves the fingers on the screen to these points, given in the order the fingers went down. It
   * throws unless it gets one point for each finger on the screen.
   */
  readonly move: (fingers: ReadonlyArray<Finger>) => Promise<void>;
  /** Lifts every finger at once. */
  readonly lift: () => Promise<void>;
};

/**
 * Runs `gesture` on Chromium's touchscreen through Vitest's CDP session, then lifts any finger
 * still down, even when `gesture` throws. `userEvent` has no multi-touch or touch drag. The fingers
 * go through the browser's own gesture detection, so a tap brings its compat mouse events and click
 * and a gesture that is no tap brings none. Chromium only.
 *
 * @param gesture - Places, moves and lifts fingers.
 * @returns What `gesture` returned.
 */
export async function withTouchscreen<T>(gesture: (screen: Touchscreen) => Promise<T>): Promise<T> {
  const session = cdp();
  // CDP takes points in the page's viewport, and the test document is a frame inside it.
  const frame = window.frameElement?.getBoundingClientRect() ?? { left: 0, top: 0 };
  let held: ReadonlyArray<Finger> = [];
  const send = (type: "touchStart" | "touchMove" | "touchEnd", fingers: ReadonlyArray<Finger>) =>
    session.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: fingers.map(({ x, y }, id) => ({ x: x + frame.left, y: y + frame.top, id })),
    });
  const screen: Touchscreen = {
    // Each call records the fingers only once CDP takes the event, so a rejected event leaves the
    // fingers that are really down for the final lift.
    place: async (fingers) => {
      const next = [...held, ...fingers];
      await send("touchStart", next);
      held = next;
    },
    move: async (fingers) => {
      if (fingers.length !== held.length) {
        throw new Error(`move takes the ${held.length} fingers on the screen, got ${fingers.length}`);
      }
      await send("touchMove", fingers);
      held = fingers;
    },
    lift: async () => {
      await send("touchEnd", []);
      held = [];
    },
  };
  try {
    return await gesture(screen);
  } finally {
    if (held.length > 0) {
      await screen.lift();
    }
  }
}
