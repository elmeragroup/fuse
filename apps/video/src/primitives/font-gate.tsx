import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { RenderHold } from "../motion/frame-clock";

/** The video's text family: the site's `--font-sans`, which `index.css` sets headings in too. */
export const VIDEO_FONT = "Roboto";

/** The video's mono family, which `index.css` sets as `--font-mono`. */
const MONO_FONT = "JetBrains Mono";

/** A family and the weights of it a frame draws with. */
export type VideoFace = {
  readonly family: string;
  readonly weights: readonly number[];
};

/**
 * Every face and weight `index.css` loads. Text is measured and drawn only once all of them are
 * ready.
 */
const FACES = [
  { family: VIDEO_FONT, weights: [400, 500, 600, 700] },
  { family: MONO_FONT, weights: [400, 500, 700] },
] as const satisfies readonly VideoFace[];

/** The faces the gate waits for, as its hold names them. */
const FACE_NAMES = FACES.map(({ family }) => family).join(" and ");

/**
 * Whether a loaded face draws a weight: its weight, or a variable face's range, includes it.
 *
 * @param face - A face the document loaded.
 * @param weight - The weight a frame draws with.
 * @returns Whether the face covers the weight.
 */
function coversWeight(face: FontFace, weight: number): boolean {
  const [low = Number.NaN, high = low] = face.weight.split(" ").map(Number);
  return low <= weight && weight <= high;
}

/**
 * Loads one weight of a family. The document answers a family no stylesheet declares with no faces,
 * and a weight it lacks with the nearest one, and either would let text draw in other metrics, so
 * both reject.
 *
 * @param family - The family.
 * @param weight - The weight.
 * @returns Once a face of that weight has loaded.
 */
async function loadFace(family: string, weight: number): Promise<void> {
  const name = `${family} at weight ${String(weight)}`;
  const loaded = await document.fonts.load(`${String(weight)} 16px "${family}"`).catch((cause: unknown) => {
    throw new Error(`${name} failed to load`, { cause });
  });
  if (!loaded.some((face) => coversWeight(face, weight))) {
    throw new Error(`No face of ${name} is declared; import it in index.css`);
  }
}

/**
 * Loads every weight of the faces.
 *
 * @param faces - The faces.
 * @returns Once every weight has loaded; rejects naming the first family and weight that did not.
 */
export async function loadFaces(faces: readonly VideoFace[]): Promise<void> {
  await Promise.all(
    faces.flatMap(({ family, weights }) => weights.map((weight) => loadFace(family, weight)))
  );
}

/**
 * Loads every face the video draws with.
 *
 * @returns Once every weight has loaded.
 */
export async function loadVideoFonts(): Promise<void> {
  await loadFaces(FACES);
}

/** Props for {@link FontGate}. */
export type FontGateProps = {
  readonly hold: RenderHold;
  /** Loads the faces, `loadVideoFonts` in the video. It rejects with an `Error`, which cancels the render. */
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
      .catch((error: Error) => {
        cancelRender(error);
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
