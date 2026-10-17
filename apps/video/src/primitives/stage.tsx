import { useLayoutEffect, useState } from "react";
import type { ReactElement, ReactNode, RefObject } from "react";

import { AbsoluteFill, useVideoConfig } from "remotion";

/** The size every scene is authored at. Fuse reads at its own pixel sizes on this stage. */
export const STAGE = { width: 1280, height: 720 } as const;

/**
 * The reference stage, scaled uniformly to the composition. At 1920×1080 it scales by 1.5, so
 * Fuse renders at 150% and every Fuse metric stays in its own units. The scale also makes the
 * stage the containing block of fixed-position overlays, so a Sheet fills the stage.
 *
 * @param props.children - The scene content, laid out at 1280×720.
 */
export function Stage({ children }: { readonly children: ReactNode }): ReactElement {
  const { width } = useVideoConfig();
  return (
    <AbsoluteFill>
      <div
        data-stage=""
        style={{
          position: "relative",
          width: STAGE.width,
          height: STAGE.height,
          overflow: "hidden",
          scale: String(width / STAGE.width),
          transformOrigin: "top left",
        }}>
        {children}
      </div>
    </AbsoluteFill>
  );
}

/** A point on the 1280×720 stage, in stage pixels. */
export type StagePoint = { readonly x: number; readonly y: number };

/** A box on the 1280×720 stage, in stage pixels: its top-left corner and its size. */
export type StageBox = StagePoint & { readonly width: number; readonly height: number };

/** The middle of the stage, where a point sits until its element is measured. */
const STAGE_CENTRE: StagePoint = { x: STAGE.width / 2, y: STAGE.height / 2 };

/**
 * An element's box relative to its nearest ancestor that carries the attribute `anchor`, from its
 * untransformed layout. It walks the offset parents up to that ancestor, adding each one's border,
 * so a scale or translate animating on an ancestor never moves the box: every frame reads the same
 * layout, whichever frame mounted it.
 */
function anchoredBoxOf(element: HTMLElement, anchor: string): StageBox {
  let x = 0;
  let y = 0;
  let current: HTMLElement | null = element;
  while (current !== null && !current.hasAttribute(anchor)) {
    x += current.offsetLeft;
    y += current.offsetTop;
    const parent: Element | null = current.offsetParent;
    current = parent instanceof HTMLElement ? parent : null;
    if (current !== null && !current.hasAttribute(anchor)) {
      x += current.clientLeft;
      y += current.clientTop;
    }
  }
  return { x, y, width: element.offsetWidth, height: element.offsetHeight };
}

/**
 * The centre of an element relative to its nearest ancestor that carries the attribute `anchor`,
 * from its untransformed layout (see {@link anchoredBoxOf}).
 *
 * @param ref - The element to measure.
 * @param anchor - The attribute that marks the ancestor the point is measured from.
 * @param initial - Where the point sits before the first layout.
 * @returns The element's centre in the anchor's pixels.
 */
export function useAnchoredPoint(
  ref: RefObject<HTMLElement | null>,
  anchor: string,
  initial: StagePoint
): StagePoint {
  const [point, setPoint] = useState<StagePoint>(initial);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    const box = anchoredBoxOf(element, anchor);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    setPoint((previous) => (previous.x === x && previous.y === y ? previous : { x, y }));
  }, [ref, anchor]);
  return point;
}

/**
 * The centre of an element in stage pixels, from its untransformed layout (see
 * {@link useAnchoredPoint}). A label's width changes with the locale, so a cursor aimed at a
 * button reads where the button really is.
 *
 * @param ref - The element to measure.
 * @returns The element's centre on the stage, or the stage's centre before the first layout.
 */
export function useStagePoint(ref: RefObject<HTMLElement | null>): StagePoint {
  return useAnchoredPoint(ref, "data-stage", STAGE_CENTRE);
}

/**
 * An element's box in stage pixels, from its untransformed layout, as {@link useStagePoint} reads
 * its centre. A part's size changes with the locale and the theme's fonts, so a frame drawn around
 * it reads where the part really is.
 *
 * @param ref - The element to measure.
 * @returns The element's box on the stage, or `null` before the first layout.
 */
export function useStageBox(ref: RefObject<HTMLElement | null>): StageBox | null {
  const [box, setBox] = useState<StageBox | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    const next = anchoredBoxOf(element, "data-stage");
    setBox((previous) =>
      previous !== null &&
      previous.x === next.x &&
      previous.y === next.y &&
      previous.width === next.width &&
      previous.height === next.height
        ? previous
        : next
    );
  }, [ref]);
  return box;
}
