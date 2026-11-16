"use client";

import { useLayoutEffect, useRef } from "react";
import type { ReactElement } from "react";

import { cn } from "../../styles/cn";
import { overlaySpotlightCutoutClass } from "../overlay/overlay-classes";
import { tourVariants } from "./tour-variants";

const cutoutClass = cn(overlaySpotlightCutoutClass, tourVariants().outline());

/**
 * The lit hole in a spotlight's dim: a box over the step's element, outlined in the primary color,
 * whose spread shadow dims the rest of the page. It ignores the pointer, so a press on the hole
 * reaches the backdrop under it. It follows the element through scrolling, resizing and layout
 * shifts by reading the element's box every frame and writing it as custom properties when it
 * changed, with no easing. It closes to a point in the middle of the viewport for a centered step,
 * which shows no outline.
 */
export function TourCutout({
  element,
  padding,
}: {
  readonly element: Element | null;
  readonly padding: number;
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
      // An element that left the page keeps its last box while the dim fades, as the popup's anchor
      // does.
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
      node.style.setProperty("--tour-cutout-x", `${box.left - grow}px`);
      node.style.setProperty("--tour-cutout-y", `${box.top - grow}px`);
      node.style.setProperty("--tour-cutout-w", `${box.width + grow * 2}px`);
      node.style.setProperty("--tour-cutout-h", `${box.height + grow * 2}px`);
      node.style.setProperty("--tour-cutout-r", `${(Number.isFinite(radius) ? radius : 0) + grow}px`);
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
  return (
    <div
      ref={ring}
      aria-hidden="true"
      data-slot="tour-cutout"
      className={element === null ? overlaySpotlightCutoutClass : cutoutClass}
    />
  );
}
