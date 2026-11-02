"use client";

/**
 * The tooltip's roof on a cartesian Root, read from the browser's own SVG geometry. Each drawn
 * element maps to client pixels through its screen transform, so a transform anywhere above it,
 * a consumer's style included, counts, and from there to plot pixels through the plot surface.
 * The browser draws each path's own data, with its stroke, onto a canvas one plot pixel per canvas
 * pixel, and each column's first painted pixel is its roof, so a curve counts where it bends and
 * a long path, such as the path form's columns, costs one draw. A box or a dot counts by its
 * bounding box. Reading the marks takes a layout, so a roof keeps its profile until the marks draw
 * something new, the popup opens again, or a data update's tween lands. During a tween the profile
 * holds every shape the loop will paint until it lands, drawn through the marks' own writers in one
 * read without a paint between, so the popup clears every frame without a read per frame.
 */
import type { ChartMotion, MarkValues, MarkWriter, ValueAxis } from "./chart-motion";
import type { PlotFrame } from "./layout/plot-frame";
import {
  boundsOf,
  box,
  ellipse,
  higherRoof,
  polyline,
  raisedRoof,
  roofProfile,
  widenedRoof,
} from "./layout/tooltip-roof";
import type { MarkPiece, PieceBounds, RoofMark, RoofProfile } from "./layout/tooltip-roof";

/** The layers that draw series marks: bars, lines, areas, dots and markers. */
const LAYERS = [
  '[data-slot="chart-bar-series"]',
  '[data-slot="chart-line-series"]',
  '[data-slot="chart-area-series"]',
  '[data-slot="chart-dots"]',
  '[data-slot="chart-marker"]',
].join(",");

/**
 * The active dots that show. They follow the pointer, so every read takes them afresh. An active
 * dot without `data-value` draws nothing at the active slot.
 */
const ACTIVE_DOTS = '[data-slot="chart-active-dot"][data-value]';

const DRAWINGS = "path, polyline, line, polygon, rect, circle, ellipse";

/**
 * Drawings that draw nothing of their own, inside a paint server, a clip or a mask, and the active
 * bar's overlay, which redraws a bar the series layer draws too and follows the pointer.
 */
const UNDRAWN =
  'defs, clipPath, mask, pattern, linearGradient, radialGradient, [data-slot="chart-bar-active"]';

/**
 * How far above and below the plot the canvas reaches, in plot pixels, for a stroke or a curve
 * that passes the plot's edge. A mark higher than this above the plot reads at this height.
 */
const OVERHANG = 128;

/** Where the plot sits on screen, which maps client pixels to plot pixels. */
export type RoofView = {
  /** The chart Root's element. */
  readonly root: Element;
  /** The plot surface's client box. */
  readonly surface: DOMRect;
  /** Client pixels per plot pixel along x and y. */
  readonly scale: { readonly x: number; readonly y: number };
  /** The stretch of plot pixels along x the profile covers. */
  readonly stretch: readonly [number, number];
  /** The Root's frame. */
  readonly frame: PlotFrame;
  /** Root's animation loop. */
  readonly motion: ChartMotion;
};

/** A Root's roof, measured at most once per change of its marks. */
export type ChartRoof = {
  /**
   * The roof profile now: the series marks as the last read found them, and the active dots as
   * they show.
   */
  readonly read: (view: RoofView) => RoofProfile;
  /** Read the series marks again on the next read, after a commit, an opening or a landing. */
  readonly forget: () => void;
  /**
   * Watch what the Root's series marks draw, and call `changed` once after each batch of DOM changes
   * that alters it:
   *
   * - any attribute of a mark or its layer, such as new geometry for a new curve, a transform, a
   *   style or class, or a variant or quality a stylesheet strokes apart;
   * - a new style or class on Root, an ancestor, or a wrapper inside Root that holds a layer, such as
   *   Glow or Reveal, which can set a mark's stroke or transform;
   * - a layer that mounts or unmounts.
   *
   * While `tweening` holds, the loop writes each frame's geometry, which the tween's read already
   * covers, so those attributes alone do not count, nor does a Marker anchor's
   * `--chart-marker-x` or `--chart-marker-y`, which the loop writes each frame too. On Root, its
   * ancestors and its wrappers only style and class count, since Root's data attributes follow the
   * pointer. A style change counts unless it only moves a private `--_` property or
   * `--chart-active-x`, which parts write as they draw and as the pointer moves. The active bar's overlay, the active dots and Root's data attributes lie outside
   * the watch, so a slot step changes nothing it sees. The roof's own read draws the moving marks
   * where they land and back, which the watch skips, since that read measured every change made
   * before it.
   *
   * @returns A function that ends the watch.
   */
  readonly watch: (root: Element, changed: () => void, tweening: () => boolean) => () => void;
};

/**
 * Create a Root's roof.
 *
 * @returns The roof.
 */
export function createChartRoof(): ChartRoof {
  let kept: RoofProfile | null = null;
  let watching: MutationObserver | null = null;
  return {
    read: (view) => {
      if (kept === null) {
        kept = seriesRoof(view);
        watching?.takeRecords();
      }
      return higherRoof(kept, roofProfile(drawnMarks(view, ACTIVE_DOTS), ...view.stretch));
    },
    forget: () => {
      kept = null;
    },
    watch: (root, changed, tweening) => {
      const observer = new MutationObserver((records) => {
        const moving = tweening();
        if (records.some((record) => changesMarks(record, root, moving))) changed();
      });
      observer.observe(root, { subtree: true, childList: true, attributes: true, attributeOldValue: true });
      for (let above = root.parentElement; above !== null; above = above.parentElement) {
        observer.observe(above, {
          attributes: true,
          attributeFilter: ["style", "class"],
          attributeOldValue: true,
        });
      }
      watching = observer;
      return () => {
        observer.disconnect();
        if (watching === observer) watching = null;
      };
    },
  };
}

/**
 * The attributes the loop writes as a tween's frames draw: a drawing's geometry and transform, and
 * a bar's side of zero. Every other attribute on a mark or its layer comes from a commit, such as
 * a new variant, quality or emphasis that a stylesheet strokes apart.
 */
const FRAME_ATTRIBUTES = new Set([
  "d",
  "points",
  "x",
  "y",
  "width",
  "height",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "transform",
  "data-negative",
]);

/** Whether a DOM change alters what a series mark draws. */
function changesMarks(record: MutationRecord, root: Element, tweening: boolean): boolean {
  const target = record.target instanceof Element ? record.target : record.target.parentElement;
  if (target === null) return false;
  if (record.type === "attributes") {
    const name = record.attributeName ?? "";
    if (tweening && FRAME_ATTRIBUTES.has(name)) return false;
    if (name === "style" && sameDrawingStyle(record.oldValue, target.getAttribute("style"), tweening))
      return false;
    const styling = name === "style" || name === "class";
    // Root, its ancestors and the wrappers inside Root that hold a layer, such as Glow and Reveal,
    // set what the marks inherit through their style and classes alone.
    if (target.contains(root) || target.querySelector(LAYERS) !== null) return styling;
    return target.closest(UNDRAWN) === null && target.closest(LAYERS) !== null;
  }
  const layers = [...record.addedNodes, ...record.removedNodes].some(
    (node) => node instanceof Element && (node.matches(LAYERS) || node.querySelector(LAYERS) !== null)
  );
  if (layers) return true;
  if (tweening) return false;
  return target.closest(UNDRAWN) === null && target.closest(LAYERS) !== null;
}

/**
 * Whether two inline styles draw alike: the same declarations once the private `--_` properties
 * and `--chart-active-x`, which parts write as they draw and as the pointer moves, are left out,
 * and while a tween runs a Marker anchor's `--chart-marker-x` and `--chart-marker-y`, which the
 * loop writes each frame.
 */
function sameDrawingStyle(before: string | null, after: string | null, tweening: boolean): boolean {
  const skipped = tweening
    ? /^(--_|--chart-active-x\s*:|--chart-marker-[xy]\s*:)/u
    : /^(--_|--chart-active-x\s*:)/u;
  const drawing = (style: string | null) =>
    (style ?? "")
      .split(";")
      .map((declaration) => declaration.trim())
      .filter((declaration) => declaration !== "" && !skipped.test(declaration))
      .join(";");
  return drawing(before) === drawing(after);
}

/**
 * The series marks' profile. During a tween it holds every shape the loop will paint on the way.
 * The marks' own writers draw them where they show, at evenly spaced fractions of the route the
 * loop takes from there to the route's end, at the route's end and where they rest, and every
 * shape drawn counts. The loop writes each frame as a fraction of that same route, so every curve,
 * slide and bridge the marks paint lies among the shapes drawn, up to the gap between two
 * neighbouring fractions, which the profile adds as a margin. A box or a dot, whose edges move in
 * straight lines, counts as one box around where it shows, where its route ends and where it rests,
 * which holds every place it passes.
 */
function seriesRoof(view: RoofView): RoofProfile {
  const tween = routeRoof(view);
  if (tween !== null) return tween;
  const raster = pathRaster(view, LAYERS);
  raster.draw();
  return higherRoof(roofProfile(drawnMarks(view, LAYERS), ...view.stretch), raster.read());
}

/**
 * The most numbers a tween's read writes in all, its fractions included. A route with more numbers
 * draws fewer fractions, each farther apart, so the read stays bounded on large charts. Measured
 * in Chromium on 2026-11-02, the read added 8 to 15 ms to a data update of two 30-reading lines,
 * and 36 to 65 ms to one of two 20,000-reading lines, with the popup open.
 */
const ROUTE_BUDGET = 120_000;

/**
 * The most fractions a route draws, however far its marks travel. A full-height move on a 600 px
 * plot then draws fractions under 2.5 px apart.
 */
const MOST_FRACTIONS = 256;

/** One moving mark: its writer, and the numbers it shows, its route ends on and it rests on. */
type Moving = {
  readonly write: MarkWriter;
  readonly drawn: MarkValues;
  readonly end: MarkValues;
  readonly target: MarkValues;
  readonly axes: readonly ValueAxis[];
};

/**
 * Every shape a tween paints, drawn through the marks' own writers and then drawn back where they
 * show, all in one task, so nothing paints between. Fractions of the route sit at most a plot
 * pixel apart along any number, up to `ROUTE_BUDGET`, past which the gap between two fractions
 * becomes the margin the profile adds above and beside each column.
 *
 * @returns The profile, or null without drawing when no mark moves.
 */
function routeRoof(view: RoofView): RoofProfile | null {
  const marks: Moving[] = [];
  view.motion.eachLanding((write, target, drawn, axes, end) => {
    marks.push({ write, drawn, end, target, axes });
  });
  if (marks.length === 0) return null;
  let travel = 0;
  let numbers = 0;
  for (const { drawn, end, axes } of marks) {
    numbers += end.length;
    end.forEach((to, index) => {
      if (axes[index % axes.length] !== "size")
        travel = Math.max(travel, Math.abs(to - (drawn[index] ?? to)));
    });
  }
  const fractions = Math.max(
    1,
    Math.min(MOST_FRACTIONS, Math.ceil(travel), Math.floor(ROUTE_BUDGET / Math.max(1, numbers)))
  );
  // How far apart two neighbouring fractions draw a number, in plot pixels.
  const gap = travel / fractions;
  const selector = `${LAYERS},${ACTIVE_DOTS}`;
  const raster = pathRaster(view, selector);
  // Each box's and dot's swept footprint: one box around where it shows, where its route ends and
  // where it rests. Its edges move in straight lines, so that box holds it in every frame, a bar
  // that slides along x with a window included.
  const swept = new Map<SVGGraphicsElement, { bounds: PieceBounds | null; reach: number }>();
  const sweep = (): void => {
    for (const drawing of drawingsOf(view, selector)) {
      if (drawing.localName === "path") continue;
      const mark = markOf(drawing, view);
      if (mark === null) continue;
      const held = swept.get(drawing);
      swept.set(drawing, {
        bounds: boundsOf(mark.pieces, held?.bounds ?? null),
        reach: Math.max(held?.reach ?? 0, mark.reach),
      });
    }
  };
  try {
    sweep();
    raster.draw();
    for (let step = 1; step <= fractions; step += 1) {
      const at = step / fractions;
      for (const { write, drawn, end } of marks) {
        write(end.map((to, index) => (drawn[index] ?? to) + (to - (drawn[index] ?? to)) * at));
      }
      raster.draw();
    }
    sweep();
    for (const { write, target } of marks) write(target);
    raster.draw();
    sweep();
    const footprints = [...swept.values()].flatMap(({ bounds, reach }) =>
      bounds === null
        ? []
        : [
            {
              pieces: box(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top),
              reach,
            },
          ]
    );
    const profile = higherRoof(roofProfile(footprints, ...view.stretch), raster.read());
    return raisedRoof(widenedRoof(profile, gap), gap);
  } finally {
    // The marks show where they showed, whatever the read did.
    for (const { write, drawn } of marks) write(drawn);
  }
}

/** A canvas of plot pixels that the paths of some layers draw onto, one state after another. */
type PathRaster = {
  /** Draw the paths as they are now, over what earlier draws left. */
  readonly draw: () => void;
  /** The profile of everything drawn so far, read once. */
  readonly read: () => RoofProfile;
};

/**
 * A raster for the paths the layers a selector names. The browser draws each path's own data
 * through its screen transform onto a canvas whose pixels are plot pixels, with its stroke's
 * width, caps and joins, and a column's first painted pixel from the top is its roof. A pixel a
 * path only grazes counts, so the roof errs high by under a pixel. The paths and their styles are
 * found once, and each draw reads only their data and transforms.
 */
function pathRaster(view: RoofView, selector: string): PathRaster {
  const [start, end] = view.stretch;
  const first = Math.floor(start);
  const width = Math.max(1, Math.ceil(end) - first);
  const height = Math.ceil(view.frame.box.height) + 2 * OVERHANG;
  const paths = drawingsOf(view, selector)
    .filter((drawing) => drawing.localName === "path")
    .map((path) => ({ path, style: getComputedStyle(path) }));
  const canvas = paths.length === 0 ? null : document.createElement("canvas");
  const context = canvas === null ? null : canvas.getContext("2d", { willReadFrequently: true });
  if (canvas !== null) {
    canvas.width = width;
    canvas.height = height;
  }
  const { surface, scale } = view;
  // Client pixels to canvas pixels: the plot's left edge at the stretch's start, its top at the
  // overhang.
  const toCanvas = new DOMMatrix()
    .translate(-first, OVERHANG)
    .scale(1 / scale.x, 1 / scale.y)
    .translate(-surface.left, -surface.top);
  return {
    draw: () => {
      if (context === null) return;
      for (const { path, style } of paths) {
        const data = path.getAttribute("d") ?? "";
        const matrix = path.getScreenCTM();
        if (data === "" || matrix === null) continue;
        const outline = new Path2D(data);
        context.setTransform(toCanvas.multiply(matrix));
        if (style.fill !== "none" && style.fill !== "") context.fill(outline);
        if (style.stroke !== "none" && style.stroke !== "") {
          context.lineWidth = Number.parseFloat(style.strokeWidth) || 0;
          context.lineCap = canvasCap(style.strokeLinecap);
          context.lineJoin = canvasJoin(style.strokeLinejoin);
          context.stroke(outline);
        }
      }
    },
    read: () => {
      const tops = new Float64Array(width).fill(Number.POSITIVE_INFINITY);
      if (context === null) return { start: first, tops };
      const pixels = context.getImageData(0, 0, width, height).data;
      for (let column = 0; column < width; column += 1) {
        for (let row = 0; row < height; row += 1) {
          if ((pixels[(row * width + column) * 4 + 3] ?? 0) > 0) {
            tops[column] = row - OVERHANG;
            break;
          }
        }
      }
      return { start: first, tops };
    },
  };
}

/** The drawings the layers a selector names hold, past those that draw nothing of their own. */
function drawingsOf(view: RoofView, selector: string): SVGGraphicsElement[] {
  const drawings: SVGGraphicsElement[] = [];
  for (const layer of view.root.querySelectorAll(selector)) {
    for (const drawing of layer.querySelectorAll<SVGGraphicsElement>(DRAWINGS)) {
      if (drawing.closest(UNDRAWN) === null) drawings.push(drawing);
    }
  }
  return drawings;
}

/** The boxes and dots the layers a selector names draw now, in plot pixels. */
function drawnMarks(view: RoofView, selector: string): RoofMark[] {
  const marks: RoofMark[] = [];
  for (const drawing of drawingsOf(view, selector)) {
    if (drawing.localName === "path") continue;
    const mark = markOf(drawing, view);
    if (mark !== null) marks.push(mark);
  }
  return marks;
}

function canvasCap(cap: string): CanvasLineCap {
  return cap === "round" || cap === "square" ? cap : "butt";
}

function canvasJoin(join: string): CanvasLineJoin {
  return join === "round" || join === "bevel" ? join : "miter";
}

/** One drawing's mark in plot pixels, or null for one the browser does not place. */
function markOf(drawing: SVGGraphicsElement, view: RoofView): RoofMark | null {
  const matrix = drawing.getScreenCTM();
  if (matrix === null) return null;
  const { surface, scale } = view;
  const toPlot = (x: number, y: number): [number, number] => {
    const point = new DOMPoint(x, y).matrixTransform(matrix);
    return [(point.x - surface.left) / scale.x, (point.y - surface.top) / scale.y];
  };
  // Plot pixels per user unit, for the stroke.
  const perUnit =
    Math.sqrt(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c)) / Math.sqrt(scale.x * scale.y);
  const style = getComputedStyle(drawing);
  const stroked = style.stroke !== "none" && style.stroke !== "";
  const reach = stroked ? ((Number.parseFloat(style.strokeWidth) || 0) / 2) * perUnit : 0;
  const pieces = piecesOf(drawing, matrix, toPlot);
  return pieces.length === 0 ? null : { pieces, reach };
}

/**
 * A drawing's pieces from its bounding box: a box or an ellipse while its transform keeps it
 * upright, and its four mapped corners otherwise.
 */
function piecesOf(
  drawing: SVGGraphicsElement,
  matrix: DOMMatrix,
  toPlot: (x: number, y: number) => [number, number]
): MarkPiece[] {
  const { x, y, width, height } = drawing.getBBox();
  const upright = Math.abs(matrix.b) < 1e-9 && Math.abs(matrix.c) < 1e-9;
  if (!upright) {
    const corners = [
      toPlot(x, y),
      toPlot(x + width, y),
      toPlot(x + width, y + height),
      toPlot(x, y + height),
    ];
    return polyline([...corners, toPlot(x, y)]);
  }
  const [x0, y0] = toPlot(x, y);
  const [x1, y1] = toPlot(x + width, y + height);
  const left = Math.min(x0, x1);
  const top = Math.min(y0, y1);
  const right = Math.max(x0, x1);
  const bottom = Math.max(y0, y1);
  return drawing.localName === "circle" || drawing.localName === "ellipse"
    ? ellipse((left + right) / 2, (top + bottom) / 2, (right - left) / 2, (bottom - top) / 2)
    : box(left, top, right - left, bottom - top);
}
