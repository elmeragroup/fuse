/**
 * The corner arithmetic the studio's Shape page draws: the radius rungs fuse.css derives from
 * `--radius` and `--radius-step`, and the concentric inner corner a shell publishes,
 * `max(0px, outer − inset)`. CONTEXT.md ("Radius rung", "Inner corner") states both, and
 * `packages/fuse/src/styles/corner-radius.ts` owns the contract.
 */

/**
 * Each rung's distance from `--radius`, in `--radius-step` lengths, as fuse.css declares it.
 * Fuse keeps the table private (`theme/tokens/radius-scale.ts`); the Shape page's browser test
 * holds these against the radii the browser computes from fuse.css.
 */
export const RUNGS = [
  { id: "xs", steps: -3 },
  { id: "sm", steps: -2 },
  { id: "md", steps: -1 },
  { id: "lg", steps: 0 },
  { id: "xl", steps: 2 },
  { id: "popover", steps: -4 },
] as const satisfies readonly { id: string; steps: number }[];

export type RungId = (typeof RUNGS)[number]["id"];

/** A rung's formula in words, such as `radius − 2 × step`. */
export function rungFormula(steps: number): string {
  if (steps === 0) {
    return "radius";
  }
  const count = Math.abs(steps);
  return `radius ${steps < 0 ? "−" : "+"} ${count === 1 ? "step" : `${String(count)} × step`}`;
}

/** The concentric corner of a part laid `inset` px inside a corner of `outer` px. */
export function innerCorner(outer: number, inset: number): number {
  return Math.max(0, outer - inset);
}

/** One box between a shell's corner and an inner part, on the inline side that reaches it. */
export type InsetBox = { readonly border: number; readonly padding: number; readonly margin: number };

/** What separates a shell's outer edge from an inner part: its borders, and its padding. */
export type Inset = { readonly border: number; readonly padding: number };

/**
 * The inset from the rounded box at `chain[0]` to the part inside the last box. Every box adds
 * its border and padding. A box below the corner also adds its margin, which can be negative,
 * as an InputGroup addon's is beside a button; the corner box's own margin lies outside it.
 * The borders are summed apart from the rest, so a label can name each.
 */
export function insetOf(chain: readonly InsetBox[]): Inset {
  let border = 0;
  let padding = 0;
  chain.forEach((box, index) => {
    border += box.border;
    padding += box.padding + (index === 0 ? 0 : box.margin);
  });
  return { border, padding };
}

/** A part's measured corner beside its shell's outer corner and the inset between them. */
export type CornerReading = Inset & { readonly outer: number; readonly inner: number };

export type CornerCheck = {
  /** The corner the concentric formula gives. */
  readonly expected: number;
  /** The inset reaches past the outer corner, so the formula clamps to 0. */
  readonly clamped: boolean;
  /** The part's corner is more than half a pixel off the formula. */
  readonly mismatch: boolean;
};

/** Half a pixel: what the browser's rounding of rem lengths can leave. */
const TOLERANCE = 0.5;

export function checkCorner({ outer, border, padding, inner }: CornerReading): CornerCheck {
  const expected = innerCorner(outer, border + padding);
  return {
    expected,
    clamped: outer - border - padding < 0,
    mismatch: Math.abs(inner - expected) > TOLERANCE,
  };
}

/** A length in px to at most two places, without trailing zeros. */
export function formatPx(px: number): string {
  return String(Math.round(px * 100) / 100);
}

/** The formula with its numbers, such as `max(0, 16 − 1 − 12) = 3px`. */
export function cornerEquation({ outer, border, padding }: Inset & { readonly outer: number }): string {
  const result = innerCorner(outer, border + padding);
  return `max(0, ${formatPx(outer)} − ${formatPx(border)} − ${formatPx(padding)}) = ${formatPx(result)}px`;
}

/**
 * The overlay's short form, such as `16 − 1 − 12 = 3px`. A clamped corner reads `→ 0px`, since
 * the difference itself is negative.
 */
export function cornerSum({ outer, border, padding }: Inset & { readonly outer: number }): string {
  const terms = `${formatPx(outer)} − ${formatPx(border)} − ${formatPx(padding)}`;
  const difference = outer - border - padding;
  return difference < 0 ? `${terms} → 0px` : `${terms} = ${formatPx(difference)}px`;
}

/** How far a square corner's ticks run along each edge, in screen px. */
const TICK = 6;

/** The top corner a part lies against: the inline-start one, or the inline-end one. */
export type CornerSide = "start" | "end";

/**
 * An SVG path for a top corner of radius `r` at the box corner (`x`, `y`): a quarter circle
 * between the box's side edge and its top edge, or two short ticks for a square corner. A
 * top-left corner runs from the left edge to the top; a top-right one from the top to the right.
 */
export function arcPath(x: number, y: number, r: number, side: CornerSide = "start"): string {
  const at = (dx: number, dy: number) => `${String(x + dx)} ${String(y + dy)}`;
  if (side === "end") {
    return r <= 0
      ? `M ${at(-TICK, 0)} L ${at(0, 0)} L ${at(0, TICK)}`
      : `M ${at(-r, 0)} A ${String(r)} ${String(r)} 0 0 1 ${at(0, r)}`;
  }
  return r <= 0
    ? `M ${at(0, TICK)} L ${at(0, 0)} L ${at(TICK, 0)}`
    : `M ${at(0, r)} A ${String(r)} ${String(r)} 0 0 1 ${at(r, 0)}`;
}

/** A point in the overlay's screen px. */
export type ScreenPoint = { readonly x: number; readonly y: number };

/** The point halfway along the top arc of radius `r` at the box corner (`x`, `y`). */
export function arcMidpoint(x: number, y: number, r: number, side: CornerSide = "start"): ScreenPoint {
  const offset = r * (1 - Math.SQRT1_2);
  return { x: side === "end" ? x - offset : x + offset, y: y + offset };
}

/** How far a redline's end ticks reach either side of it, in screen px. */
const REDLINE_TICK = 3;

/** An SVG path for a horizontal redline from `fromX` to `toX` at `y`, ticked at both ends. */
export function insetRedline(fromX: number, toX: number, y: number): string {
  const tick = (x: number) =>
    `M ${String(x)} ${String(y - REDLINE_TICK)} L ${String(x)} ${String(y + REDLINE_TICK)}`;
  return `${tick(fromX)} M ${String(fromX)} ${String(y)} L ${String(toX)} ${String(y)} ${tick(toX)}`;
}

/** A box's four corner radii, in px. */
export type CornerRadii = {
  readonly topLeft: number;
  readonly topRight: number;
  readonly bottomRight: number;
  readonly bottomLeft: number;
};

/**
 * The radii a box paints with: its resolved radii, scaled down together when two corners on a
 * side need more than the side's length. CSS takes `f = min(Lᵢ / Sᵢ)` over the four sides,
 * where `Sᵢ` is the sum of the side's two radii, and scales every radius by `f` when it is
 * below 1 (CSS Backgrounds, "Overlapping Curves").
 *
 * @param width - The box's border-box width.
 * @param height - The box's border-box height.
 * @param radii - The radii the box resolves.
 */
export function usedRadii(width: number, height: number, radii: CornerRadii): CornerRadii {
  const { topLeft, topRight, bottomRight, bottomLeft } = radii;
  const sides = [
    [width, topLeft + topRight],
    [width, bottomLeft + bottomRight],
    [height, topLeft + bottomLeft],
    [height, topRight + bottomRight],
  ] as const;
  const f = Math.min(1, ...sides.map(([length, sum]) => (sum > 0 ? length / sum : 1)));
  return {
    topLeft: topLeft * f,
    topRight: topRight * f,
    bottomRight: bottomRight * f,
    bottomLeft: bottomLeft * f,
  };
}

/** A label to place: its arc anchor, its rendered size, and the corner side it names. */
export type LabelBox = {
  readonly anchor: ScreenPoint;
  readonly width: number;
  readonly height: number;
  readonly side: CornerSide;
};

/** Where a label goes, and whether it moved off its anchor, so a leader joins them. */
export type PlacedLabel = { readonly x: number; readonly y: number; readonly leader: boolean };

/** How far a label sits from its anchor, and keeps from the canvas edges and other labels. */
const LABEL_OFFSET = 2;
const LABEL_EDGE = 4;
const LABEL_GAP = 2;

type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

function collides(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width + LABEL_GAP &&
    b.x < a.x + a.width + LABEL_GAP &&
    a.y < b.y + b.height + LABEL_GAP &&
    b.y < a.y + a.height + LABEL_GAP
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Where a label's leading edge can sit along one axis, within `min..max`, nearest `target`
 * first: `target` clamped into range, both canvas edges, and flush either side of each placed
 * label's span.
 */
function edgesNear(
  target: number,
  size: number,
  min: number,
  max: number,
  spans: readonly (readonly [start: number, length: number])[]
): number[] {
  const edges = [clamp(target, min, max), min, max];
  for (const [start, length] of spans) {
    edges.push(start + length + LABEL_GAP, start - size - LABEL_GAP);
  }
  return edges
    .filter((edge) => edge >= min && edge <= max)
    .toSorted((a, b) => Math.abs(a - target) - Math.abs(b - target));
}

/**
 * Places every label beside its anchor, inside `bounds`, with no two overlapping. A label
 * hangs right of a start-side anchor and left of an end-side one, 2px below it. Labels pack
 * from the top: one that collides tries the columns and rows at the canvas edges and flush
 * beside each placed label, nearest its natural place first, column by column, and a label
 * moved off its natural place gets a leader. A label with no free place left in the bounds is
 * dropped; the readout still lists it.
 *
 * @param labels - The labels, in any order.
 * @param bounds - The canvas size, in screen px.
 * @returns Each label's place, in the order given, or `undefined` for a dropped label.
 */
export function packLabels(
  labels: readonly LabelBox[],
  bounds: { readonly width: number; readonly height: number }
): (PlacedLabel | undefined)[] {
  const placed: Rect[] = [];
  const places: (PlacedLabel | undefined)[] = Array.from({ length: labels.length });
  const order = labels
    .map((label, index) => ({ label, index }))
    .toSorted((a, b) => a.label.anchor.y - b.label.anchor.y || a.label.anchor.x - b.label.anchor.x);
  for (const { label, index } of order) {
    const { anchor, width, height, side } = label;
    const natural = {
      x: side === "end" ? anchor.x - LABEL_OFFSET - width : anchor.x + LABEL_OFFSET,
      y: anchor.y + LABEL_OFFSET,
    };
    const right = bounds.width - LABEL_EDGE - width;
    const bottom = bounds.height - LABEL_EDGE - height;
    const columns = edgesNear(
      natural.x,
      width,
      LABEL_EDGE,
      right,
      placed.map((rect) => [rect.x, rect.width])
    );
    const rows = edgesNear(
      natural.y,
      height,
      LABEL_EDGE,
      bottom,
      placed.map((rect) => [rect.y, rect.height])
    );
    const spot = firstFree(columns, rows, width, height, placed);
    if (spot !== undefined) {
      placed.push(spot);
      places[index] = {
        x: spot.x,
        y: spot.y,
        leader: Math.abs(spot.x - natural.x) > 0.5 || Math.abs(spot.y - natural.y) > 0.5,
      };
    }
  }
  return places;
}

/** The first `width` × `height` box, trying each row of each column in turn, that no placed box touches. */
function firstFree(
  columns: readonly number[],
  rows: readonly number[],
  width: number,
  height: number,
  placed: readonly Rect[]
): Rect | undefined {
  for (const x of columns) {
    for (const y of rows) {
      const rect = { x, y, width, height };
      if (!placed.some((other) => collides(other, rect))) {
        return rect;
      }
    }
  }
  return undefined;
}
