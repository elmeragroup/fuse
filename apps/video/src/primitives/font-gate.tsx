import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { RenderHold } from "../motion/frame-clock";

/** The video's text family: the site's `--font-sans`, which Neo Sans headings fall back to. */
export const VIDEO_FONT = "Roboto";

/** The video's mono family, which `index.css` sets as `--font-mono`. */
const MONO_FONT = "JetBrains Mono";

/**
 * Every face and weight `index.css` loads. Text is measured and drawn only once all of them are
 * ready.
 */
const FACES = [
  { family: VIDEO_FONT, weights: [400, 500, 600, 700] },
  { family: MONO_FONT, weights: [400, 500, 700] },
] as const;

/** The faces the gate waits for, as its hold and error messages name them. */
const FACE_NAMES = FACES.map(({ family }) => family).join(" and ");

/**
 * Loads every face the video draws with.
 *
 * @returns Once every weight has loaded.
 */
export async function loadVideoFonts(): Promise<void> {
  await Promise.all(
    FACES.flatMap(({ family, weights }) =>
      weights.map((weight) => document.fonts.load(`${String(weight)} 16px "${family}"`))
    )
  );
}

/** Props for {@link FontGate}. */
export type FontGateProps = {
  readonly hold: RenderHold;
  /** Loads the faces, `loadVideoFonts` in the video. */
  readonly load: () => Promise<void>;
  /** The content that draws text, and the seek helper that settles it. */
  readonly children: ReactNode;
};

/**
 * Renders its children once the video's faces have loaded, and holds the render until they have
 * committed. It releases its hold in a layout effect after that commit; its children's layout
 * effects run first, so whatever they hold, such as the seek helper's settle, is held before the
 * gate lets go and the frame is never ready in between.
 *
 * @returns The children once the faces are ready.
 */
export function FontGate({ hold, load, children }: FontGateProps): ReactNode {
  const [ready, setReady] = useState(false);
  const { delayRender, continueRender, cancelRender } = hold;
  const handle = useRef<number | null>(null);

  useLayoutEffect(() => {
    const held = delayRender(`Loading ${FACE_NAMES}`);
    handle.current = held;
    let active = true;
    load()
      .then(() => {
        if (active) {
          setReady(true);
        }
      })
      .catch(() => {
        cancelRender(new Error(`The ${FACE_NAMES} faces failed to load`));
      });
    return () => {
      active = false;
      if (handle.current === held) {
        handle.current = null;
        continueRender(held);
      }
    };
  }, [load, delayRender, continueRender, cancelRender]);

  useLayoutEffect(() => {
    const held = handle.current;
    if (ready && held !== null) {
      handle.current = null;
      continueRender(held);
    }
  }, [ready, continueRender]);

  return ready ? children : null;
}
