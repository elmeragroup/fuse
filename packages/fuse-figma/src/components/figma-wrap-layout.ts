/**
 * How Figma lays out the layers of a horizontal auto layout row with `layoutWrap` WRAP, as the live
 * probes WR1 to WR9 read it (README, "How the spec is built"), over lengths already resolved to
 * pixels. The builder holds a captured CSS layout to this model before it draws a row as WRAP, and
 * a test that places a wrapping row's layers places them with it, so both read one model.
 * Chromium's layout is the oracle each holds it to, and the probes are the model's own evidence.
 *
 * - A line takes layers in order and breaks before the first whose width, with the gap before it,
 *   passes the room the line has left. A layer that fits exactly stays (WR1). A layer wider than the
 *   row takes a line of its own and overflows it (WR2).
 * - A layer breaks a line at its own width where it is fixed or hugs, and a filling layer at its
 *   `minWidth` (WR6).
 * - The filling layers of a line share the room its other layers and gaps leave, alike, each at least
 *   its `minWidth` (WR6).
 * - Each line packs its layers at its start, as `primaryAlign` MIN does (WR1, WR6), `itemSpacing`
 *   apart (WR3).
 * - The lines stack from the row's content top, `counterAxisSpacing` apart (WR3, WR9), each as tall as
 *   its tallest layer, and each layer sits across its line by `counterAxisAlignItems` (WR3).
 *
 * A row with height to spare centres its lines as a block (WR4), which this model does not place:
 * its callers lay out rows whose lines fill their height. Neither does it place a layer that fills
 * across its line, which no probe read.
 */

import type { CounterAlignSpec } from "./kit-spec";

/** How a layer of a WRAP row is wide: a fixed or hugging width, or filling above a least width. */
export type WrapWidth =
  | { readonly kind: "fixed"; readonly width: number }
  | { readonly kind: "hug"; readonly width: number }
  | { readonly kind: "fill"; readonly minWidth: number };

/** A layer of a WRAP row as the model takes it: its key, how wide it is and how tall. */
export type WrapLayer = {
  readonly key: string;
  readonly width: WrapWidth;
  readonly height: number;
};

/** A WRAP row as the model lays it out, its lengths in pixels. */
export type WrapRow = {
  /** The width of the row's content box, its width less its padding and its stroke's room. */
  readonly room: number;
  /** The gap between the layers of a line, `itemSpacing`. */
  readonly itemSpacing: number;
  /** The gap between lines, `counterAxisSpacing`. */
  readonly lineGap: number;
  /** Where each layer sits across its line, `counterAxisAlignItems`. */
  readonly counterAlign: CounterAlignSpec;
  /** The layers in order. */
  readonly layers: readonly WrapLayer[];
};

/** Where the model places a layer, relative to the row's content box, and the line it takes. */
export type WrapPlace = {
  readonly key: string;
  readonly line: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** The width at which a layer breaks a line: its own, or a filling layer's least width (WR6). */
function breakWidth(width: WrapWidth): number {
  return width.kind === "fill" ? width.minWidth : width.width;
}

/** Where a layer sits across its line, as `counterAxisAlignItems` places it. */
function across(align: CounterAlignSpec, line: number, height: number): number {
  switch (align) {
    case "MIN":
      return 0;
    case "CENTER":
      return (line - height) / 2;
    case "MAX":
      return line - height;
  }
}

/**
 * Lay out a WRAP row's layers as Figma does (WR1 to WR9).
 *
 * @param row - The row, its lengths in pixels.
 * @returns Each layer's place, in the row's order.
 */
export function layOutWrap(row: WrapRow): readonly WrapPlace[] {
  const lines: WrapLayer[][] = [];
  let used = 0;
  for (const layer of row.layers) {
    const width = breakWidth(layer.width);
    const line = lines.at(-1);
    if (line !== undefined && used + row.itemSpacing + width <= row.room) {
      line.push(layer);
      used += row.itemSpacing + width;
    } else {
      lines.push([layer]);
      used = width;
    }
  }
  const places: WrapPlace[] = [];
  let top = 0;
  lines.forEach((line, index) => {
    const tallest = Math.max(...line.map(({ height }) => height));
    const taken = line.reduce((sum, { width }) => (width.kind === "fill" ? sum : sum + width.width), 0);
    const filling = line.filter(({ width }) => width.kind === "fill").length;
    const share = (row.room - taken - row.itemSpacing * (line.length - 1)) / Math.max(1, filling);
    let x = 0;
    for (const { key, width, height } of line) {
      const drawn = width.kind === "fill" ? Math.max(width.minWidth, share) : width.width;
      places.push({
        key,
        line: index,
        x,
        y: top + across(row.counterAlign, tallest, height),
        width: drawn,
        height,
      });
      x += drawn + row.itemSpacing;
    }
    top += tallest + row.lineGap;
  });
  return places;
}
