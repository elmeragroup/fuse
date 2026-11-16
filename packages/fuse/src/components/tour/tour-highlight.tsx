"use client";

import { useLayoutEffect, useRef } from "react";
import type { ReactElement } from "react";

/**
 * A box over the step's element: the lit hole of `Tour.Spotlight` or the outline of `Tour.Ring`. It
 * ignores the pointer. It follows the element through scrolling, resizing and layout shifts by
 * reading the element's box every frame and writing it as the `--tour-highlight-*` properties when it
 * changed, with no easing. It closes to a point in the middle of the viewport for a centered step.
 */
export function TourHighlight({
  element,
  padding,
  slot,
  className,
}: {
  readonly element: Element | null;
  readonly padding: number;
  readonly slot: "tour-cutout" | "tour-ring";
  readonly className: string;
}): ReactElement {
  const ring = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ring.current;
    if (node === null) {
      return;
    }
    let frame = 0;
    let written = "";
    // The element moves with scrolling, resizing and layout shifts that nothing announces, such as a
    // late image or an opening banner, so every frame reads its box and writes it only when it changed.
    const measure = (): void => {
      // An element that left the page, such as a Beacon that unmounts when its tip ends, keeps its last
      // box while the highlight fades, as the popup's anchor does.
      if (element !== null && !element.isConnected && written !== "") {
        return;
      }
      const box =
        element === null || !element.isConnected
          ? new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0)
          : element.getBoundingClientRect();
      const grow = element === null ? 0 : padding;
      const geometry = `${box.left - grow} ${box.top - grow} ${box.width + grow * 2} ${box.height + grow * 2}`;
      if (geometry === written) {
        return;
      }
      written = geometry;
      const radius = element === null ? 0 : Number.parseFloat(getComputedStyle(element).borderTopLeftRadius);
      node.style.setProperty("--tour-highlight-x", `${box.left - grow}px`);
      node.style.setProperty("--tour-highlight-y", `${box.top - grow}px`);
      node.style.setProperty("--tour-highlight-w", `${box.width + grow * 2}px`);
      node.style.setProperty("--tour-highlight-h", `${box.height + grow * 2}px`);
      node.style.setProperty("--tour-highlight-r", `${(Number.isFinite(radius) ? radius : 0) + grow}px`);
    };
    const follow = (): void => {
      measure();
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [element, padding]);
  return <div ref={ring} aria-hidden="true" data-slot={slot} className={className} />;
}
