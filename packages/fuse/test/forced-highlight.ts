/**
 * Checks for a state that forced-colors mode shows as a Highlight fill, the `forced-highlight`
 * utility in fuse.css, and for the focus outline it draws. The fill checks compare an element
 * with the state against the same element without it, since the emulated Highlight is
 * translucent and no exact color holds across schemes. The focus check reads the system colors
 * the page resolves. Callers run them under `withForcedColors("active", …)`.
 */
import { expect } from "vitest";
import { userEvent } from "vitest/browser";

import * as Srgb from "@elmeragroup/color/srgb";

import { systemFace } from "./media-emulation";
import { finishAnimations, pixelContrast, rgbAt, screenshotOf } from "./screenshot-pixels";
import type { Point } from "./screenshot-pixels";
import { toSrgb } from "./surface-paint";

/** Whether a computed `clip-path` or `clip` hides all of an element, as `sr-only` sets them. */
function clipsAll(style: CSSStyleDeclaration): boolean {
  const inset = /^inset\((\d+(?:\.\d+)?)%\)$/.exec(style.clipPath);
  return (inset !== null && Number(inset[1]) >= 50) || style.clip === "rect(0px, 0px, 0px, 0px)";
}

/**
 * The part of a text box that paints: the box cut to the padding box of each ancestor, from the
 * text's parent up to `root`, that clips its overflow. Text under a hidden ancestor, or one whose
 * clip hides all of it, paints none.
 *
 * @param box - One box of a text run.
 * @param parent - The text's parent element.
 * @param root - The element whose text runs are read.
 * @returns The box's painted part, or `undefined` where the text paints nothing.
 */
function paintedPart(box: DOMRect, parent: Element, root: Element): DOMRect | undefined {
  if (getComputedStyle(parent).visibility !== "visible") return undefined;
  let [left, top, right, bottom] = [box.left, box.top, box.right, box.bottom];
  for (let ancestor: Element | null = parent; ancestor !== null; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor);
    if (clipsAll(style)) return undefined;
    if (style.overflowX !== "visible" || style.overflowY !== "visible") {
      const edge = ancestor.getBoundingClientRect();
      left = Math.max(left, edge.left + ancestor.clientLeft);
      top = Math.max(top, edge.top + ancestor.clientTop);
      right = Math.min(right, edge.left + ancestor.clientLeft + ancestor.clientWidth);
      bottom = Math.min(bottom, edge.top + ancestor.clientTop + ancestor.clientHeight);
    }
    if (ancestor === root) break;
  }
  return right > left && bottom > top ? new DOMRect(left, top, right - left, bottom - top) : undefined;
}

/**
 * The painted boxes of each of an element's text runs, where forced colors paint a backplate. A
 * run that paints nothing, such as an `sr-only` label, is left out.
 */
function textRuns(element: Element): { readonly text: string; readonly boxes: DOMRect[] }[] {
  const runs: { readonly text: string; readonly boxes: DOMRect[] }[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = (node.textContent ?? "").trim();
    const parent = node.parentElement;
    if (text === "" || parent === null) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const boxes = [...range.getClientRects()].flatMap((box) => paintedPart(box, parent, element) ?? []);
    if (boxes.length > 0) runs.push({ text, boxes });
  }
  return runs;
}

/**
 * Where a screenshot of an element starts, in viewport pixels: the whole pixel its border box's
 * top left corner falls in, as `screenshotOf` crops it.
 */
function shotOrigin(element: Element) {
  const box = element.getBoundingClientRect();
  return { left: Math.floor(box.left), top: Math.floor(box.top) };
}

/** The boxes of an element's text. */
function textBoxes(element: Element): DOMRect[] {
  return textRuns(element).flatMap((run) => run.boxes);
}

/** The boxes of an element's text and icons, which differ with the text color alone. */
function glyphBoxes(element: Element): DOMRect[] {
  return [
    ...textBoxes(element),
    ...[...element.querySelectorAll("svg")].map((svg) => svg.getBoundingClientRect()),
  ];
}

/** One screenshot of an element in a state and one of the same element without it. */
type StateShots = readonly [withState: ImageData, without: ImageData];

/**
 * One screenshot each of an element in a state and of the same element without it, taken once
 * their animations finish.
 *
 * @param withState - The element in the state.
 * @param without - The same element, with the same content, without the state.
 * @returns The two screenshots, in that order.
 * @throws When the two screenshots differ in size by more than 1px, where the pixels do not pair up.
 */
async function stateShots(withState: HTMLElement, without: HTMLElement): Promise<StateShots> {
  finishAnimations([withState, without]);
  const [a, b] = await Promise.all([screenshotOf(withState), screenshotOf(without)]);
  if (Math.abs(a.width - b.width) > 1 || Math.abs(a.height - b.height) > 1) {
    throw new Error("expected two screenshots of the same size");
  }
  return [a, b];
}

/**
 * The {@link stateShare} of two elements, read from their {@link stateShots}.
 *
 * @param withState - The element in the state.
 * @param without - The same element, with the same content, without the state.
 * @param shots - The screenshots of the two elements.
 * @returns A share from 0 to 1.
 */
function shareOf(withState: HTMLElement, without: HTMLElement, [a, b]: StateShots): number {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const masked = new Uint8Array(width * height);
  for (const element of [withState, without]) {
    const box = shotOrigin(element);
    for (const glyph of glyphBoxes(element)) {
      for (
        let row = Math.floor(glyph.top - box.top) - 1;
        row < Math.ceil(glyph.bottom - box.top) + 1;
        row++
      ) {
        for (
          let column = Math.floor(glyph.left - box.left) - 1;
          column < Math.ceil(glyph.right - box.left) + 1;
          column++
        ) {
          if (column >= 0 && row >= 0 && column < width && row < height) masked[row * width + column] = 1;
        }
      }
    }
  }
  let counted = 0;
  let differing = 0;
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      if (masked[row * width + column] === 1) continue;
      counted++;
      const atA = (row * a.width + column) * 4;
      const atB = (row * b.width + column) * 4;
      if (
        [0, 1, 2].some((channel) => Math.abs((a.data[atA + channel] ?? 0) - (b.data[atB + channel] ?? 0)) > 2)
      ) {
        differing++;
      }
    }
  }
  if (counted === 0) throw new Error("expected pixels outside the text and icons");
  return differing / counted;
}

/**
 * The share of pixels, outside text and icons, where two elements of the same size paint
 * differently. Glyphs are left out, and a pixel beside them too, so a part whose state changes
 * only its text color or weight reads 0. Two screenshots 1px apart in size, as a fractional
 * position gives, compare over the size they share.
 *
 * @param withState - The element in the state.
 * @param without - The same element, with the same content, without the state.
 * @returns A share from 0 to 1.
 * @throws When the two screenshots differ in size by more than 1px, where the pixels do not pair up.
 */
export async function stateShare(withState: HTMLElement, without: HTMLElement): Promise<number> {
  return shareOf(withState, without, await stateShots(withState, without));
}

/** How one of an element's text runs paints on the fill behind it. */
type TextPaint = {
  /** The run's text, for the failure message. */
  readonly text: string;
  /** The share of pixels inside the run's boxes that show the fill, from 0 to 1. */
  readonly underText: number;
  /** The highest WCAG contrast between a pixel inside the run's boxes and the fill, from 1 to 21. */
  readonly ink: number;
};

/**
 * How each of an element's text runs paints on a fill, read from a screenshot of the element.
 * Glyphs on a fill leave most of their box in the fill and ink the rest. Forced colors paint a
 * Canvas backplate behind the text of a part that keeps `forced-color-adjust: auto`, which covers
 * the box and leaves no fill under it, and text in a color near the fill's inks it at a low
 * contrast. Each run counts alone, so a title that reads cannot hide a description that does not.
 *
 * @param element - An element that holds text.
 * @param shot - A screenshot of the element.
 * @param fill - The fill's pixel, from 0 to 255. Its first three channels, RGB, count.
 * @returns Each run that shows at least one pixel, with the share of the fill under it and its
 * ink's contrast against the fill.
 * @throws When no text run of the element shows.
 */
function textPaint(element: HTMLElement, shot: ImageData, fill: readonly number[]): TextPaint[] {
  const box = shotOrigin(element);
  const paints: TextPaint[] = [];
  for (const run of textRuns(element)) {
    let inside = 0;
    let onFill = 0;
    let ink = 1;
    for (const glyph of run.boxes) {
      for (let row = Math.ceil(glyph.top - box.top); row < Math.floor(glyph.bottom - box.top); row++) {
        for (
          let column = Math.ceil(glyph.left - box.left);
          column < Math.floor(glyph.right - box.left);
          column++
        ) {
          if (column < 0 || row < 0 || column >= shot.width || row >= shot.height) continue;
          const pixel = rgbAt(shot, [column, row]);
          inside++;
          if (pixel.every((channel, index) => Math.abs(channel - (fill[index] ?? 0)) <= 2)) onFill++;
          ink = Math.max(ink, pixelContrast(pixel, fill));
        }
      }
    }
    if (inside > 0) paints.push({ text: run.text, underText: onFill / inside, ink });
  }
  if (paints.length === 0) throw new Error("expected text inside the element");
  return paints;
}

/** The most common color of a screenshot, RGB from 0 to 255. */
function mostCommon(shot: ImageData): number[] {
  const counts = new Map<string, number>();
  for (let index = 0; index < shot.data.length; index += 4) {
    const key = shot.data.subarray(index, index + 3).join(",");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const [top] = [...counts.entries()].reduce((best, entry) => (entry[1] > best[1] ? entry : best));
  return top.split(",").map(Number);
}

/** Checks that each text run reads on its fill, as {@link expectTextOnFill} describes. */
function expectTextPaints(paints: readonly TextPaint[], label: string): void {
  for (const { text, underText, ink } of paints) {
    expect(underText, `${label} fill under "${text}"`).toBeGreaterThan(1 / 3);
    expect(ink, `${label} "${text}" against the fill`).toBeGreaterThanOrEqual(4.5);
  }
}

/**
 * Checks that each of an element's text runs reads on a fill: the fill shows under more than a
 * third of the pixels in the run's boxes, where a Canvas backplate shows none, and the run's
 * glyphs ink it at WCAG 1.4.3's 4.5:1 for text.
 *
 * @param element - An element that holds text.
 * @param fill - The fill's pixel, RGBA from 0 to 255.
 * @param label - What the text is, for the failure message.
 */
export async function expectTextOnFill(
  element: HTMLElement,
  fill: readonly number[],
  label: string
): Promise<void> {
  finishAnimations([element]);
  expectTextPaints(textPaint(element, await screenshotOf(element), fill), label);
}

/**
 * Checks that the state paints a fill: more than half of the element's pixels outside its text
 * and icons differ from the same element without the state. Where the element holds text, it also
 * checks that the text reads on the element's own fill, its most common color, as
 * {@link expectTextOnFill} does. Both checks read the same screenshot of the element in the state.
 *
 * @param withState - The element in the state.
 * @param without - The same element, with the same content, without the state.
 * @param label - What the state is, for the failure message.
 */
export async function expectStateFill(
  withState: HTMLElement,
  without: HTMLElement,
  label: string
): Promise<void> {
  const shots = await stateShots(withState, without);
  expect(shareOf(withState, without, shots), `${label} fill share`).toBeGreaterThan(0.5);
  if (textBoxes(withState).length === 0) return;
  const [shot] = shots;
  expectTextPaints(textPaint(withState, shot, mostCommon(shot)), label);
}

/**
 * Gives an element keyboard focus. It presses Shift first, so the browser takes the focus as
 * keyboard focus and matches `:focus-visible`.
 *
 * @param element - The element to focus.
 * @throws When the element does not match `:focus-visible`.
 */
export async function focusByKeyboard(element: HTMLElement): Promise<void> {
  await userEvent.keyboard("{Shift}");
  element.focus();
  if (!element.matches(":focus-visible")) throw new Error("expected the element to match :focus-visible");
}

/** A color's RGB channels from 0 to 255, unrounded, to compare with a screenshot pixel. */
function pixelChannels({ r, g, b }: Srgb.Srgb): number[] {
  return [r, g, b].map((channel) => channel * 255);
}

/**
 * Checks that a focused part draws a 2px `HighlightText` outline inside its `Highlight` fill, 2px
 * in from each edge. Along the lines through the element's center it reads 8 pixels inward from
 * each edge, from the first pixel wholly inside the box. It places each pixel on the line from
 * the fill, 0, to the stroke, 1, and expects the fill or the part's border first, then the
 * stroke, then the fill. The stroke's shares add up to 2px within 0.4px, and their weighted
 * middle sits 3px in from the box's fractional edge within 0.5px. So the check holds wherever the
 * box falls on the pixel grid, as at a fractional translate, where the edge and the outline only
 * partly cover their pixels. The forced palette's Highlight is translucent, so the fill is
 * Highlight over Canvas, and the part's own border, Highlight over that fill, lies past the
 * fill's end of the line. Call it under `withForcedColors("active", …)` with the element, or a
 * control inside it, focused. It first finishes the animations on the element and its
 * ancestors, so a popup still moving in does not shift the pixels. The element needs at least
 * 6px of fill between each edge and its text or icon along those lines, since glyphs paint in
 * the stroke's color.
 *
 * @param element - The part, such as a pressed toggle or a selected row.
 * @param label - What the part is, for the failure message.
 */
export async function expectFocusInsideFill(element: HTMLElement, label: string): Promise<void> {
  finishAnimations([element], { ancestors: true });
  const highlight = systemFace("Highlight");
  const fill = pixelChannels(
    Srgb.compositeOver(toSrgb(highlight.background), toSrgb(systemFace("Canvas").background))
  );
  const stroke = pixelChannels(toSrgb(highlight.text));
  const span = stroke.map((channel, index) => channel - (fill[index] ?? 0));
  const length = span.reduce((sum, channel) => sum + channel * channel, 0);
  /** Where a pixel lies on the line from the fill, 0, to the stroke, 1. */
  const along = (pixel: readonly number[]): number =>
    span.reduce((sum, channel, index) => sum + ((pixel[index] ?? 0) - (fill[index] ?? 0)) * channel, 0) /
    length;
  /** Whether a pixel shows the fill, each channel within one 8-bit step. */
  const isFill = (pixel: readonly number[]): boolean =>
    fill.every((channel, index) => Math.abs(channel - (pixel[index] ?? 0)) <= 1);
  const shot = await screenshotOf(element);
  // The screenshot starts at the whole pixel the box's edge falls in. Each side reads its pixels
  // from the first one wholly inside the box, at `start`, inward by `step`, and `point` places a
  // position on the side's line. The edge and the pixel centers count inward along the profile,
  // in screenshot pixels, so the far sides negate them.
  const box = element.getBoundingClientRect();
  const left = box.left - Math.floor(box.left);
  const top = box.top - Math.floor(box.top);
  const right = box.right - Math.floor(box.left);
  const bottom = box.bottom - Math.floor(box.top);
  const across = Math.floor((left + right) / 2);
  const down = Math.floor((top + bottom) / 2);
  const depths = [0, 1, 2, 3, 4, 5, 6, 7];
  // The point at a position on the row through the center, and at one on the column through it.
  const onRow = (column: number): Point => [column, down];
  const onColumn = (row: number): Point => [across, row];
  const sides = [
    { side: "left", edge: left, start: Math.ceil(left), step: 1, point: onRow },
    { side: "right", edge: -right, start: Math.floor(right) - 1, step: -1, point: onRow },
    { side: "top", edge: top, start: Math.ceil(top), step: 1, point: onColumn },
    { side: "bottom", edge: -bottom, start: Math.floor(bottom) - 1, step: -1, point: onColumn },
  ];
  const read = sides.map(({ side, edge, start, step, point }) => {
    const positions = depths.map((depth) => start + step * depth);
    const pixels = positions.map((position) => rgbAt(shot, point(position)));
    const profile = pixels.map(along);
    const centers = positions.map((position) => step * (position + 0.5));
    const core = profile.findIndex((share) => share >= 0.85);
    if (core === -1) return { side, outer: false, width: false, inset: false, inner: false };
    // The stroke's run: the core and the pixels beside it it partly covers.
    let first = core;
    while (first > 0 && (profile[first - 1] ?? 0) > 0.05) first--;
    let last = core;
    while (last < profile.length - 1 && (profile[last + 1] ?? 0) > 0.05) last++;
    const run = profile.slice(first, last + 1).map((share) => Math.min(share, 1));
    const width = run.reduce((sum, share) => sum + share, 0);
    const middle =
      run.reduce((sum, share, index) => sum + share * (centers[first + index] ?? 0), 0) / width - edge;
    return {
      side,
      // The fill's side of the line before the stroke: the fill, or the part's border on it.
      outer: profile.slice(0, first).some((share) => share <= 0.1),
      width: Math.abs(width - 2) <= 0.4,
      // A 2px stroke from 2px to 4px in has its middle 3px in.
      inset: Math.abs(middle - 3) <= 0.5,
      inner: pixels.slice(last + 1).some(isFill),
    };
  });
  expect(read, label).toEqual(
    sides.map(({ side }) => ({ side, outer: true, width: true, inset: true, inner: true }))
  );
}
