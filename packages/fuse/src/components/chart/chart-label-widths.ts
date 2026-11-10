"use client";

/**
 * The measured ink of a polar layer's labels on their rays. The server places each label by the
 * label-width table's estimate and one cap height, its box trimmed to its cap height and the font's
 * descent. Once the client can measure, it writes each label's own ink width and height as `--_w`
 * and `--_h`, which its place's support along the ray reads, and how far its ink's middle lies from
 * its box's middle as `--_ink-dx` and `--_ink-dy`, which its translate takes back, so the middle of
 * the ink itself lands on its ray, a descender or a glyph's side bearing included. It renders nothing
 * and commits nothing.
 */
import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

import { writeStyle } from "./chart-dom";

/** Whether the engine trims a text box, as the stylesheet asks it to. */
let trimmed: boolean | undefined;

/** Whether the engine trims a label's box to its cap height and the font's descent. */
function trims(): boolean {
  trimmed ??= CSS.supports("text-box", "trim-both cap text");
  return trimmed;
}

/** One canvas the measures share, made on first use. */
let measuring: CanvasRenderingContext2D | null | undefined;

/** The ink box of a label's text in its own font, from the canvas's text metrics. */
function inkOf(label: HTMLElement): TextMetrics | null {
  if (measuring === undefined) measuring = document.createElement("canvas").getContext("2d");
  if (measuring === null) return null;
  const style = getComputedStyle(label);
  measuring.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return measuring.measureText(label.textContent);
}

/**
 * Write a label's ink size and the offset that puts its ink's middle where its box's middle is, or,
 * for a label drawn on a chip, the chip's own size, since the chip is what sits on the ray.
 */
function writeInk(label: Element, by: "ink" | "box"): void {
  if (!(label instanceof HTMLElement)) return;
  const box = label.getBoundingClientRect();
  if (box.width === 0) return;
  const ink = by === "ink" ? inkOf(label) : null;
  if (ink === null) {
    writeStyle(label, "--_h", `${box.height.toFixed(2)}px`);
    writeStyle(label, "--_w", `${box.width.toFixed(2)}px`);
    return;
  }
  const width = ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight;
  const height = ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent;
  // The box runs from the text's origin to its advance, and from its cap height down to the font's
  // descent, where the stylesheet trims it, or down its whole line, whose baseline sits half the
  // leading and the font's ascent below its top. The ink's middle lies this far right and below the
  // box's.
  const baseline = trims()
    ? box.height - ink.fontBoundingBoxDescent
    : (box.height - ink.fontBoundingBoxAscent - ink.fontBoundingBoxDescent) / 2 + ink.fontBoundingBoxAscent;
  const dx = (ink.actualBoundingBoxRight - ink.actualBoundingBoxLeft) / 2 - box.width / 2;
  const dy = baseline + (ink.actualBoundingBoxDescent - ink.actualBoundingBoxAscent) / 2 - box.height / 2;
  writeStyle(label, "--_w", `${width.toFixed(2)}px`);
  writeStyle(label, "--_h", `${height.toFixed(2)}px`);
  writeStyle(label, "--_ink-dx", `${(-dx).toFixed(3)}px`);
  writeStyle(label, "--_ink-dy", `${(-dy).toFixed(3)}px`);
  // The text then starts on a device pixel, so the engine draws its glyphs where the metrics put
  // them instead of snapping them up to half a pixel off the ray.
  const placed = label.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const offX = (Math.round(placed.left * ratio) - placed.left * ratio) / ratio;
  const offY = (Math.round(placed.top * ratio) - placed.top * ratio) / ratio;
  writeStyle(label, "--_ink-dx", `${(offX - dx).toFixed(3)}px`);
  writeStyle(label, "--_ink-dy", `${(offY - dy).toFixed(3)}px`);
}

/**
 * Measure the labels in a layer and write each one's ink, or its chip's box, again whenever any of
 * them changes size, as a web font that loads does.
 *
 * @param by - "ink" for bare text, "box" for a label drawn on a chip.
 * @returns The ref for the layer.
 */
export function useLabelWidths(by: "ink" | "box" = "ink"): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const layer = ref.current;
    if (layer === null) return undefined;
    for (const label of layer.children) writeInk(label, by);
    const sizes = new ResizeObserver((entries) => {
      for (const { target } of entries) writeInk(target, by);
    });
    for (const label of layer.children) sizes.observe(label);
    return () => {
      sizes.disconnect();
    };
  });
  return ref;
}
