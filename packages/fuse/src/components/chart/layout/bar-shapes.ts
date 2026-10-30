/**
 * The shapes one bar draws for its `variant`, after evilcharts' bar looks, from the bar's own
 * rectangle. `barParts` shapes them, and `drawnBar` snaps every part through the plot frame's one
 * pixel floor, so no look narrows a body to nothing. A tween recomputes them from each frame's
 * rectangle, so a cap, a face or a block track moves with its bar.
 */
import { snapBody, snapSpan } from "./plot-frame";
import type { PlotFrame, PlotRect } from "./plot-frame";

/** The bar looks of CONTRACT section 6. */
export type BarVariant =
  | "default"
  | "hatched"
  | "duotone"
  | "duotone-reverse"
  | "gradient"
  | "striped"
  | "blocks"
  | "expandable"
  | "isometric";

/** Where a bar sits, which every shape beyond the body reads. */
export type BarPlacement = {
  readonly orientation: "vertical" | "horizontal";
  readonly negative: boolean;
};

/** The rectangles of one bar's look, before snapping. Only `body` is always present. */
export type BarRects = {
  /** The painted bar. */
  readonly body: PlotRect;
  /** The striped look's solid cap beyond the far end. */
  readonly cap?: PlotRect | undefined;
  /** The blocks look's faint column of squares from the base to the plot's edge. */
  readonly track?: PlotRect | undefined;
};

/** The shapes one bar draws. Only `body` is always present. */
export type BarParts = {
  /** The bar's box, which every look but blocks paints. */
  readonly body: PlotRect;
  /** The striped look's solid cap beyond the far end. */
  readonly cap?: PlotRect | undefined;
  /** The blocks look's whole squares, counted from the bar's own base. */
  readonly blocks?: readonly PlotRect[] | undefined;
  /** The blocks look's faint squares from the bar's base to the plot's edge. */
  readonly track?: readonly PlotRect[] | undefined;
  /** The isometric look's top face, as SVG polygon points. */
  readonly top?: string;
  /** The isometric look's side face, as SVG polygon points. */
  readonly side?: string;
};

/** The size of one square of the blocks look and the gap above it, in CSS pixels. */
const BLOCK = 10;
const BLOCK_GAP = 2;

/** The depth of the isometric faces, in CSS pixels. */
const DEPTH = 10;

/** The striped cap's thickness and its gap from the bar's far end, in CSS pixels. */
const CAP = 2;
const CAP_GAP = 2;

/** The expandable look's resting strip, a share of the bar centred in it. */
const STRIP = 0.12;

/** Split a rectangle into its span along the slot axis and its span along the value axis. */
function axes(rect: PlotRect, orientation: "vertical" | "horizontal") {
  return orientation === "vertical"
    ? { along: [rect.x, rect.width] as const, across: [rect.y, rect.height] as const }
    : { along: [rect.y, rect.height] as const, across: [rect.x, rect.width] as const };
}

/** Join a span along the slot axis and one along the value axis into a rectangle. */
function join(
  along: readonly [number, number],
  across: readonly [number, number],
  orientation: "vertical" | "horizontal"
): PlotRect {
  return orientation === "vertical"
    ? { x: along[0], width: along[1], y: across[0], height: across[1] }
    : { y: along[0], height: along[1], x: across[0], width: across[1] };
}

/**
 * Whether the far end of a bar lies at the start of the value axis's coordinates: the top of a
 * positive vertical bar and the left of a negative horizontal one.
 */
function farAtStart({ orientation, negative }: BarPlacement): boolean {
  return orientation === "vertical" ? !negative : negative;
}

/**
 * The rectangles of one bar's look, unsnapped.
 *
 * @param variant - The bar's look.
 * @param rect - The bar's rectangle.
 * @param placement - The orientation and the sign of the bar.
 * @param plotLength - The plot's length along the value axis, where the blocks track ends.
 * @returns The rectangles, in CSS pixels from the plot's top left.
 */
export function barParts(
  variant: BarVariant,
  rect: PlotRect,
  placement: BarPlacement,
  plotLength: number
): BarRects {
  const { orientation } = placement;
  const { along, across } = axes(rect, orientation);
  const [start, size] = along;
  const [from, length] = across;
  const atStart = farAtStart(placement);
  switch (variant) {
    case "expandable":
      return { body: join([start + size * ((1 - STRIP) / 2), size * STRIP], across, orientation) };
    case "striped": {
      const cap = atStart ? from - CAP_GAP - CAP : from + length + CAP_GAP;
      return { body: rect, cap: join(along, [cap, CAP], orientation) };
    }
    case "blocks": {
      // Whole squares only, at least one, from the base, so the far end sits on a square's edge. The
      // column never runs wider than its bar.
      const width = Math.min(size, BLOCK, Math.max(BLOCK_GAP, size - BLOCK_GAP));
      const blocks = Math.max(
        BLOCK,
        Math.floor(length / (BLOCK + BLOCK_GAP)) * (BLOCK + BLOCK_GAP) - BLOCK_GAP
      );
      const centre = start + (size - width) / 2;
      const base = atStart ? from + length : from;
      return {
        body: join([centre, width], atStart ? [base - blocks, blocks] : [base, blocks], orientation),
        track: join(
          [centre, width],
          atStart ? [0, base] : [base, Math.max(0, plotLength - base)],
          orientation
        ),
      };
    }
    default:
      return { body: rect };
  }
}

/** The isometric faces of a snapped body, `depth` deep up and to the right, as SVG polygon points. */
function isometricFaces({ x, y, width, height }: PlotRect, depth: number) {
  const point = (px: number, py: number): string => `${String(px)},${String(py)}`;
  return {
    top: [
      point(x, y),
      point(x + width, y),
      point(x + width + depth, y - depth),
      point(x + depth, y - depth),
    ].join(" "),
    side: [
      point(x + width, y),
      point(x + width + depth, y - depth),
      point(x + width + depth, y + height - depth),
      point(x + width, y + height),
    ].join(" "),
  };
}

/**
 * The whole squares of a blocks column, 10 px each with a 2 px gap, counted from the column's base
 * outward and each snapped through `snapBody`. Every segment counts from its own base, so a stacked
 * segment shows whole squares wherever it starts, at rest and in every tween frame.
 */
function squares(
  frame: PlotFrame,
  column: PlotRect,
  atStart: boolean,
  within: readonly [number, number]
): PlotRect[] {
  const { along, across } = axes(column, frame.orientation);
  const [from, length] = across;
  const count = Math.floor((length + BLOCK_GAP) / (BLOCK + BLOCK_GAP) + 1e-9);
  const base = atStart ? from + length : from;
  return Array.from({ length: count }, (_, index) => {
    const near = index * (BLOCK + BLOCK_GAP);
    const span: readonly [number, number] = atStart ? [base - near - BLOCK, BLOCK] : [base + near, BLOCK];
    return snapBody(frame, join(along, span, frame.orientation), within);
  });
}

/**
 * The shapes one bar draws at a rectangle: its look's rectangles, each snapped through the plot
 * frame's `snapBody` with its pixel floor, the blocks look's squares counted from the bar's own
 * base, and the isometric faces built on the snapped body, their depth a whole number of device
 * pixels. A tween frame's rectangle draws through here too.
 *
 * @param frame - The layout's frame.
 * @param variant - The bar's look.
 * @param rect - The bar's rectangle, a tween frame's or its target.
 * @param bar - Whether the drawn bar hangs below its base, and its drawn top weight. A weight above
 *   0, a stack's outer segment or one on its way there, runs its blocks track on to the plot's
 *   edge over the empty column, and the track's opacity follows the weight.
 * @returns The shapes, every rectangle edge on the device pixel grid.
 */
export function drawnBar(
  frame: PlotFrame,
  variant: BarVariant,
  rect: PlotRect,
  bar: { readonly negative: boolean; readonly top: number }
): BarParts {
  const { negative } = bar;
  const { orientation, box } = frame;
  const length = orientation === "vertical" ? box.height : box.width;
  const rects = barParts(variant, rect, { orientation, negative }, length);
  // Every part keeps its pixels inside its bar's, so a look that narrows the bar, as the expandable
  // strip does, never takes a device pixel past it, at any origin and pixel ratio.
  const [start, size] = axes(rect, orientation).along;
  const within = snapSpan(frame, start, start + size);
  const body = snapBody(frame, rects.body, within);
  const parts: BarParts = {
    body,
    cap: rects.cap === undefined ? undefined : snapBody(frame, rects.cap, within),
  };
  if (variant === "isometric")
    return { ...parts, ...isometricFaces(body, Math.round(DEPTH * box.dpr) / box.dpr) };
  if (variant !== "blocks" || rects.track === undefined) return parts;
  const atStart = farAtStart({ orientation, negative });
  const blocks = squares(frame, rects.body, atStart, within);
  return {
    ...parts,
    blocks,
    track: bar.top > 0 ? squares(frame, rects.track, atStart, within) : undefined,
  };
}

/** Every shape name beyond the body, in the order a bar draws them. */
export const DETAIL_PARTS = ["track", "cap", "top", "side", "blocks"] as const;
