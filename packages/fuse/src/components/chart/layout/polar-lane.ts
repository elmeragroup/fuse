/**
 * Where a polar tooltip rests. The popup sits in a side lane beside the dial,
 * outside the labels past the rim and inside the Root's figure, with its vertical centre on the
 * active ray's height at the rim. A ray right of 12 o'clock takes the right lane and a ray left of
 * it the left, and a popup keeps its lane until the ray is 20° past 12 or 6 o'clock on the other
 * side. When neither side lane fits beside the dial inside the viewport, the popup sits below the
 * labels, or above the chart where below would leave the viewport. A pointer that
 * moves toward the open popup inside the triangle from its last plot position to the popup's near
 * edge keeps the active part, past the rim only.
 */
import type { PlaceSize } from "./tooltip-place";

/** A point in client pixels. */
export type LanePoint = { readonly x: number; readonly y: number };

/** A box in client pixels. */
export type LaneBox = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

/** The lanes a popup can take. */
export type LaneSide = "right" | "left" | "bottom" | "top";

/**
 * The dial in client pixels: its centre, its outer radius, and how far below the centre its drawing
 * ends, the radius for a full dial and 0 for a semicircle on its flat edge.
 */
export type LaneDial = { readonly centre: LanePoint; readonly radius: number; readonly bottom?: number };

/**
 * Where a popup rests: the lane it takes, its box there, the widest it may be in that lane, and the
 * box its middle stays inside as it rides the hand, the figure less any controls below it.
 */
export type LaneRest = {
  readonly side: LaneSide;
  readonly box: LaneBox;
  readonly room: number;
  readonly bounds: LaneBox;
};

/** The gap between the dial or its labels and the popup, in CSS pixels, the overlay's 8 px. */
const LANE_GAP = 8;

/** How far past 12 or 6 o'clock, as a sine, a ray must turn before the popup changes lane: sin 20°. */
const SWITCH = Math.sin((20 * Math.PI) / 180);

/**
 * The side lane for a ray: right of 12 o'clock is right, left of it is left, and a half turn's tie
 * goes right. A popup already in a lane keeps it until the ray reaches 20° into the other half.
 *
 * @param angle - The ray's angle in degrees from 12 o'clock, clockwise.
 * @param current - The lane the popup is in, or null when it opens.
 * @returns The lane.
 */
export function laneSide(angle: number, current: "right" | "left" | null): "right" | "left" {
  const sine = Math.sin((angle * Math.PI) / 180);
  if (current === "right") return sine < -SWITCH ? "left" : "right";
  if (current === "left") return sine > SWITCH ? "right" : "left";
  return sine < -1e-9 ? "left" : "right";
}

/**
 * The height a side lane's popup centres on for a ray: the ray's rim point, clamped so the popup
 * stays inside its bounds.
 *
 * @param angle - The ray's angle in degrees.
 * @param dial - The dial.
 * @param height - The popup's height.
 * @param bounds - The box the popup stays inside.
 * @returns The popup's vertical centre, in client pixels.
 */
export function laneY(angle: number, dial: LaneDial, height: number, bounds: LaneBox): number {
  const y = dial.centre.y - dial.radius * Math.cos((angle * Math.PI) / 180);
  const low = bounds.top + height / 2;
  const high = bounds.bottom - height / 2;
  return high < low ? (low + high) / 2 : Math.min(high, Math.max(low, y));
}

/** The narrowest side lane a popup takes, in CSS pixels; a narrower lane sends it below the dial. */
const LANE_MIN = 128;

/** The widest a side lane's popup grows, in CSS pixels, 16rem; wider content wraps. */
export const LANE_WIDEST = 256;

/**
 * The room past its content a popup asks of a side lane, in CSS pixels: the widest label is already
 * in the measured content, and the rows grow by a few pixels at most from item to item.
 */
export const LANE_PAD = 12;

/**
 * The width a popup needs in a side lane to show its content without clipping: its max-content
 * width, at least `LANE_MIN` and at most `LANE_WIDEST`, past which its text wraps.
 *
 * @param content - The popup's max-content width, with any room it asks past it.
 * @returns The width it needs.
 */
export function laneNeed(content: number): number {
  return Math.max(LANE_MIN, Math.min(content, LANE_WIDEST));
}

/**
 * The width a popup takes in a lane, the same on every step: its widest content, at least
 * `LANE_MIN`, the popup's own floor, and at most the room and `LANE_WIDEST`.
 *
 * @param room - The lane's room.
 * @param content - The widest content the popup shows.
 * @param widest - The most the lane lets the popup grow.
 * @returns The width.
 */
export function laneWidth(room: number, content: number, widest: number): number {
  return Math.min(room, widest, Math.max(LANE_MIN, content));
}

/** What a popup's lane reads: the ray, the dial, what it stays clear of, and its own size. */
export type LaneInput = {
  /** The ray's angle in degrees. */
  readonly angle: number;
  /** The side lane `laneSide` chose. */
  readonly side: "right" | "left";
  readonly dial: LaneDial;
  /** The union of the labels past the rim, or null for none. */
  readonly labels: LaneBox | null;
  /** The union of the Root's own controls, its legend and table toggle, or null for none. */
  readonly controls: LaneBox | null;
  /** The popup's size. */
  readonly size: PlaceSize;
  /** The box the popup stays inside beside the dial, the Root's figure. */
  readonly bounds: LaneBox;
  /** The widest content the popup shows, its max-content width. */
  readonly content: number;
  /** The visible area's bottom edge, the visual viewport's, which every lane stays above when it can. */
  readonly viewportBottom: number;
  /** The visible area's top edge, the visual viewport's, which every lane stays below when it can. */
  readonly viewportTop: number;
  /** The visible area's left edge, the visual viewport's, which every lane stays right of. */
  readonly viewportLeft: number;
  /** The visible area's right edge, the visual viewport's, which every lane stays left of. */
  readonly viewportRight: number;
  /** The chart's title, the element its Root's `aria-labelledby` names and its Headline, or null. */
  readonly title: LaneBox | null;
  /**
   * The side the popup last showed, kept across closes, so a popup that reopens starts from it. A
   * bottom or top lane it names is kept while it fits. A side lane follows `side`, which keeps its
   * own hysteresis.
   */
  readonly keep: LaneSide;
};

/**
 * Where the popup rests for a ray. Every lane is a candidate, in order: its side lane, the other side
 * lane, the bottom lane below the Root's controls, the bottom lane below the rim, and the top lane.
 * A side lane is a candidate only when its room holds the popup's widest content and `LANE_PAD`
 * (`laneNeed`). Each candidate has a span, the vertical interval it may use: its own bounds, less
 * any controls, cut to the viewport. It fits only when its span holds the popup's height, so a popup
 * that fits anywhere rests inside the viewport and clear of the controls; a span that controls
 * cut below the popup's height, or to nothing, as a side legend can, never takes it.
 * The popup takes the bottom or top lane it last showed (`keep`, kept across closes, so a reopened
 * popup starts from it) while that lane fits, so a re-measure on scroll or resize moves no popup
 * whose lane still fits, and otherwise the first candidate that fits. Where none fits, it takes the
 * candidate that shows the most of its height inside its own span, the earlier on a tie.
 *
 * - A side lane's inner edge sits one gap outside the further of the rim and the labels. Across, its
 *   span runs from there to the figure's outer side, both cut to the visible area's sides, so a pan
 *   that hides the inner edge moves the popup's near side to the visible edge; its room is that
 *   span's width. Its popup centres on the ray's rim height, clamped into its bounds: the Root's
 *   figure, less any controls under it, cut to the viewport.
 * - The bottom lane's top sits one gap below the labels and the controls, so the popup never covers
 *   the legend or the table toggle a pointer reaches for next, or one gap below the rim, each moved
 *   down to the viewport's top when the dial is scrolled above it. Its span runs from there to the
 *   viewport's bottom.
 * - The bottom and top lanes centre on the dial, inside the figure cut to the visible area's sides,
 *   or inside the visible area alone where that cut is narrower than the popup's floor, and a side
 *   lane's room ends at the cut too, so a pinch zoom that narrows the visible area keeps every lane
 *   in it.
 * - The top lane's bottom sits one gap above the highest of the dial, the labels, the controls and
 *   the title, moved up to the viewport's bottom when the dial is scrolled below it. Its span runs
 *   from the viewport's top to there.
 *
 * The bottom and top lanes never move on a step: the popup's content swaps in place. In every lane
 * the popup takes one width on every step: its widest content, within the room.
 *
 * @param input - The ray, the dial, the obstacles, the viewport and the popup.
 * @returns The lane it rests in, its box, its room and the box its middle stays inside.
 */
export function laneRest(input: LaneInput): LaneRest {
  const {
    angle,
    side,
    dial,
    labels,
    controls,
    size,
    bounds,
    content,
    viewportBottom,
    viewportTop,
    viewportLeft,
    viewportRight,
    title,
    keep,
  } = input;
  const { centre, radius } = dial;
  const { height } = size;
  /** A box's vertical bounds cut to the viewport; the horizontal cut follows it. */
  const visible = (box: LaneBox): LaneBox => ({
    ...box,
    top: Math.max(box.top, viewportTop),
    bottom: Math.min(box.bottom, viewportBottom),
  });
  const right = Math.max(centre.x + radius, labels?.right ?? Number.NEGATIVE_INFINITY) + LANE_GAP;
  const left = Math.min(centre.x - radius, labels?.left ?? Number.POSITIVE_INFINITY) - LANE_GAP;
  // Across, every lane stays inside the figure cut to the visible area's sides, as `visible` cuts
  // it down. A side lane's span runs from its inner edge, one gap past the rim and the labels, to
  // the figure's outer side, both cut there, so a pan that hides the inner edge moves the popup's
  // near side to the visible edge, and a span narrower than the popup's need is no candidate.
  const wide = { left: Math.max(bounds.left, viewportLeft), right: Math.min(bounds.right, viewportRight) };
  const sideSpans = {
    right: { left: Math.max(right, wide.left), right: wide.right },
    left: { left: wide.left, right: Math.min(left, wide.right) },
  };
  const rooms = {
    right: sideSpans.right.right - sideSpans.right.left,
    left: sideSpans.left.right - sideSpans.left.left,
  };
  /** A candidate lane and the vertical span it may use. */
  type Candidate = {
    readonly lane: LaneRest;
    readonly span: { readonly top: number; readonly bottom: number };
  };
  /** How much of a candidate's popup lies inside its span. */
  const shown = ({ lane, span }: Candidate): number =>
    Math.max(0, Math.min(lane.box.bottom, span.bottom) - Math.max(lane.box.top, span.top));
  /** Whether a candidate's span holds the popup's height. */
  const fits = ({ span }: Candidate): boolean => span.bottom - span.top >= height - 1e-6;
  const sideLane = (at: "right" | "left"): Candidate => {
    const room = rooms[at];
    const width = laneWidth(room, content, LANE_WIDEST);
    const from = at === "right" ? sideSpans.right.left : sideSpans.left.right - width;
    const over = controls !== null && from < controls.right && from + width > controls.left;
    const kept = visible(
      over ? { ...bounds, bottom: Math.min(bounds.bottom, controls.top - LANE_GAP) } : bounds
    );
    const top = laneY(angle, dial, height, kept) - height / 2;
    return {
      lane: {
        side: at,
        box: { left: from, top, right: from + width, bottom: top + height },
        room,
        bounds: kept,
      },
      span: kept,
    };
  };
  // The bottom and top lanes may leave the figure across, but not the visible area: where the
  // figure's visible part is narrower than the popup's floor, they take the visible area's width.
  const spread = wide.right - wide.left >= LANE_MIN ? wide : { left: viewportLeft, right: viewportRight };
  const room = Math.max(0, spread.right - spread.left);
  const width = laneWidth(room, content, room);
  const x = Math.min(spread.right - width, Math.max(spread.left, centre.x - width / 2));
  const across = (lane: "bottom" | "top", top: number): Candidate => ({
    lane: {
      side: lane,
      box: { left: x, top, right: x + width, bottom: top + height },
      room,
      bounds: { ...bounds, ...spread },
    },
    span: lane === "bottom" ? { top, bottom: viewportBottom } : { top: viewportTop, bottom: top + height },
  });
  const rim =
    Math.max(centre.y + (dial.bottom ?? radius), labels?.bottom ?? Number.NEGATIVE_INFINITY) + LANE_GAP;
  const clear = controls === null ? rim : Math.max(rim, controls.bottom + LANE_GAP);
  const ceiling =
    Math.min(
      centre.y - radius,
      labels?.top ?? Number.POSITIVE_INFINITY,
      controls?.top ?? Number.POSITIVE_INFINITY,
      title?.top ?? Number.POSITIVE_INFINITY
    ) - LANE_GAP;
  const other = side === "right" ? "left" : "right";
  const need = laneNeed(content + LANE_PAD);
  const candidates: Candidate[] = [
    ...(rooms[side] >= need ? [sideLane(side)] : []),
    ...(rooms[other] >= need ? [sideLane(other)] : []),
    across("bottom", Math.max(clear, viewportTop)),
    across("bottom", Math.max(rim, viewportTop)),
    across("top", Math.min(ceiling, viewportBottom) - height),
  ];
  const kept =
    keep === "bottom" || keep === "top"
      ? candidates.find((candidate) => candidate.lane.side === keep && fits(candidate))
      : undefined;
  const first = kept ?? candidates.find(fits);
  if (first !== undefined) return first.lane;
  return candidates.reduce((best, candidate) => (shown(candidate) > shown(best) ? candidate : best)).lane;
}

/**
 * Whether a point lies inside a triangle or on its edge, by the signs of its barycentric areas.
 *
 * @param point - The point.
 * @param a - A corner.
 * @param b - Another corner.
 * @param c - The third corner.
 * @returns True inside or on an edge.
 */
export function inTriangle(point: LanePoint, a: LanePoint, b: LanePoint, c: LanePoint): boolean {
  const cross = (p: LanePoint, q: LanePoint, r: LanePoint) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = cross(a, b, point);
  const d2 = cross(b, c, point);
  const d3 = cross(c, a, point);
  const negative = d1 < 0 || d2 < 0 || d3 < 0;
  const positive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(negative && positive);
}

/**
 * The near edge of a popup seen from a point: the two corners of the box's side that faces it.
 *
 * @param from - Where the pointer left the plot.
 * @param box - The popup's client box.
 * @returns The near edge's two ends.
 */
export function nearEdge(
  from: LanePoint,
  box: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
): readonly [LanePoint, LanePoint] {
  const dx = from.x < box.left ? box.left - from.x : from.x > box.right ? from.x - box.right : 0;
  const dy = from.y < box.top ? box.top - from.y : from.y > box.bottom ? from.y - box.bottom : 0;
  if (dx >= dy) {
    const x = from.x < box.left ? box.left : box.right;
    return [
      { x, y: box.top },
      { x, y: box.bottom },
    ];
  }
  const y = from.y < box.top ? box.top : box.bottom;
  return [
    { x: box.left, y },
    { x: box.right, y },
  ];
}
