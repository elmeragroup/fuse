"use client";

/**
 * The fit guard of a polar centre. The centre's text never shrinks below
 * the 12 px floor: when its printed text reaches past the square inscribed in the hole, or comes
 * within 2 px of the hole's edge, as a two-line value filling the square does at its corners, the
 * centre drops every line but the value, and when the value alone still reaches past, it drops the
 * value too, which the tooltip, the legend and the table still carry. It writes `data-fit` and
 * renders nothing.
 */
import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

import { writeAttribute } from "./chart-dom";

/** How far, in CSS pixels, text may reach past the square before it counts as overflowing. */
const SLACK = 0.5;

/** The room, in CSS pixels, text keeps from the hole's edge, as every label keeps from another. */
const EDGE = 2;

/**
 * The boxes of a centre's printed text: each text run's, and a rolling digit's window, since the
 * rest of its reel sits clipped outside it. A value that wraps between its number and its unit
 * fills the square's width with its own box, but not with its text.
 */
function printed(hole: HTMLElement): DOMRect[] {
  const rects: DOMRect[] = [];
  const walk = (node: Node): void => {
    if (node instanceof Element && node.matches("[data-part='digit']")) {
      rects.push(node.getBoundingClientRect());
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent ?? "").trim() === "") return;
      const range = document.createRange();
      range.selectNodeContents(node);
      rects.push(...range.getClientRects());
      return;
    }
    for (const child of node.childNodes) walk(child);
  };
  walk(hole);
  return rects;
}

/**
 * Whether the hole's text reaches past the hole: past its inscribed square, or within 2 px of the
 * circle round it.
 */
function overflows(hole: HTMLElement): boolean {
  const bounds = hole.getBoundingClientRect();
  const cx = bounds.left + bounds.width / 2;
  const cy = bounds.top + bounds.height / 2;
  const room = (bounds.width * Math.SQRT2) / 2 - EDGE;
  return printed(hole).some((box) => {
    if (box.width === 0 && box.height === 0) return false;
    if (
      box.left < bounds.left - SLACK ||
      box.right > bounds.right + SLACK ||
      box.top < bounds.top - SLACK ||
      box.bottom > bounds.bottom + SLACK
    )
      return true;
    const x = Math.max(Math.abs(box.left - cx), Math.abs(box.right - cx));
    const y = Math.max(Math.abs(box.top - cy), Math.abs(box.bottom - cy));
    return Math.hypot(x, y) > room;
  });
}

/**
 * Fit a centre's text to its hole: every line, else the value alone, else nothing.
 *
 * @param hole - The centre's hole, whose `data-fit` the stylesheet reads.
 */
function fitCentre(hole: HTMLElement): void {
  writeAttribute(hole, "data-fit", null);
  if (!overflows(hole)) return;
  writeAttribute(hole, "data-fit", "value");
  if (!overflows(hole)) return;
  writeAttribute(hole, "data-fit", "none");
}

/**
 * Keep a centre's text fitted to its hole: before the first paint, and again whenever the hole or
 * any of its lines changes size, as a new value does.
 *
 * @returns The ref for the hole.
 */
export function useCentreFit(): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const hole = ref.current;
    if (hole === null) return undefined;
    const fit = (): void => {
      fitCentre(hole);
    };
    fit();
    const sizes = new ResizeObserver(fit);
    const watch = (): void => {
      sizes.disconnect();
      sizes.observe(hole);
      for (const line of hole.querySelectorAll(":scope > *, :scope > * > *")) sizes.observe(line);
    };
    watch();
    // Observing the lines anew reports each one's size, so the ResizeObserver fits before paint.
    const lines = new MutationObserver(watch);
    lines.observe(hole, { childList: true, subtree: true, characterData: true });
    return () => {
      sizes.disconnect();
      lines.disconnect();
    };
  }, []);
  return ref;
}
