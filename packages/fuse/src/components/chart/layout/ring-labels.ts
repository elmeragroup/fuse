/**
 * Which ring values a polar RadiusAxis prints at each container width, and along which spoke. The
 * values sit beside the 12 o'clock spoke, or the 6 o'clock one where the marks leave that more room,
 * one per ring, each on its own chip that starts 4 px right of the spoke, so an area-true scale,
 * which draws outer rings closer together, leaves them less room. A stride of the ticks thins them,
 * and each wider dial keeps every value a narrower one showed. A value shows only clear of its
 * neighbours, of every angle label the dial shows at that width, of the marks at rest and of the
 * hole's centre text.
 */
import { LABEL_GAP } from "./polar-labels";
import { TICK_BUCKETS } from "./tick-fit";

/** A ring value's line box in CSS pixels, 12 px text on a 16 px line. */
const LINE = 16;

/** The room every ring value keeps from its neighbour, an angle label and the hole, in CSS pixels. */
const GAP = 2;

/** Where a ring value's chip starts right of the spoke, and the chip's padding either side, in CSS pixels. */
const CHIP = { offset: 4, padding: 2 } as const;

/** The strides the ticks may thin to, finest first. Each divides those after it that it may follow. */
const STRIDES = [1, 2, 3, 4, 6, 12] as const;

/** A ring value: its ring's radius as a share of the dial's, and its text's width in CSS pixels. */
export type RingLabel = { readonly radius: number; readonly width: number };

/** An angle label the dial may show, which a ring value keeps clear of. */
export type AngleObstacle = {
  /** Its angle in degrees from 12 o'clock. */
  readonly angle: number;
  /** Its text's width in CSS pixels. */
  readonly width: number;
  /** The narrowest container width it shows at, as the angle axis thins it. */
  readonly shownAt: number | "always" | "none";
};

/**
 * Whether a mark at rest covers a point, given in CSS pixels from the dial's centre, y down, on a
 * dial of a radius in CSS pixels.
 */
export type MarkCover = (x: number, y: number, radius: number) => boolean;

/** The spoke the values run along: 0 for 12 o'clock, 180 for 6 o'clock. */
export type RingAnchor = 0 | 180;

/** What a dial's ring values keep clear of: its angle labels on their rays, the marks and the hole's text. */
export type RingClearance = {
  /** The radius, as a share of the dial's, below which a value would cover the hole's centre text. */
  readonly inner: number;
  readonly angles: readonly AngleObstacle[];
  /** The marks at rest, which no value may cover. */
  readonly marks?: MarkCover;
  /** The spoke the values run along, 12 o'clock by default. */
  readonly anchor?: RingAnchor;
};

/** A box in CSS pixels from the dial's centre, y down. */
type Box = { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number };

/**
 * The narrowest container width, from `TICK_BUCKETS`, at which each ring value shows, or "none".
 *
 * @param rings - Each tick's ring value, in tick order.
 * @param clear - The angle labels and the hole's edge.
 * @returns Each tick's visibility.
 */
export function fitRingLabels(rings: readonly RingLabel[], clear: RingClearance): (number | "none")[] {
  // Each value's room at each width. A label that only a wider dial shows can take a value's room
  // there, so a value starts to show only at a width from which it keeps its room at every wider one.
  const rooms = TICK_BUCKETS.map((bucket) => roomAt(rings, clear, bucket));
  const kept = rooms.map((room, at) =>
    room.map((_, index) => rooms.slice(at).every((wider) => wider[index] === true))
  );
  const shownAt = rings.map((): number | "none" => "none");
  let current: number | null = null;
  TICK_BUCKETS.forEach((bucket, at) => {
    const room = kept[at] ?? [];
    // A stride takes the values it adds and keeps every value a narrower dial showed.
    const takes = (stride: number): boolean[] =>
      rings.map((_, index) => shownAt[index] !== "none" || (room[index] === true && index % stride === 0));
    const stride = STRIDES.find(
      (candidate) =>
        (current === null || current % candidate === 0) && spaced(rings, takes(candidate), bucket / 2)
    );
    if (stride === undefined) return;
    current = stride;
    rings.forEach((_, index) => {
      if (shownAt[index] === "none" && room[index] === true && index % stride === 0) shownAt[index] = bucket;
    });
  });
  return shownAt;
}

/** Whether each value has room on the spoke at a width: clear of the shown angle labels, the marks and the hole. */
function roomAt(rings: readonly RingLabel[], clear: RingClearance, bucket: number): boolean[] {
  const radius = bucket / 2;
  const obstacles = clear.angles.flatMap((label) =>
    label.shownAt === "always" || (label.shownAt !== "none" && label.shownAt <= bucket)
      ? [angleBox(label, radius)]
      : []
  );
  return rings.map((ring) => {
    const centre = ring.radius * radius;
    if (centre - LINE / 2 - GAP < clear.inner * radius) return false;
    const y = clear.anchor === 180 ? centre : -centre;
    const chip = {
      left: CHIP.offset,
      right: CHIP.offset + ring.width + 2 * CHIP.padding,
      top: y - LINE / 2,
      bottom: y + LINE / 2,
    };
    return obstacles.every((box) => !meets(chip, box)) && !covered(chip, clear.marks, radius);
  });
}

/**
 * The spoke whose values show the most, summed over every width: 12 o'clock unless 6 o'clock shows
 * strictly more, as where the marks crowd the top of the dial.
 *
 * @param rings - Each tick's ring value, in tick order.
 * @param clear - The angle labels, the marks and the hole's edge.
 * @returns The spoke.
 */
export function ringAnchor(rings: readonly RingLabel[], clear: RingClearance): RingAnchor {
  const score = (anchor: RingAnchor): number =>
    fitRingLabels(rings, { ...clear, anchor }).reduce<number>(
      (sum, shown) => sum + (shown === "none" ? 0 : TICK_BUCKETS.filter((bucket) => bucket >= shown).length),
      0
    );
  return score(180) > score(0) ? 180 : 0;
}

/**
 * The narrowest container width, from `TICK_BUCKETS`, from which a label on a hand, its middle on
 * the hand's ray inside the rim as the hand's label sits (Fix R4), keeps the gap from the hole and
 * its centre text, or "none" where no width does. The label nears the rim as the dial grows, so a
 * width it clears at, it clears at every wider one.
 *
 * @param label - Its angle and its box's width in CSS pixels.
 * @param inner - The hole's radius as a share of the dial's.
 * @returns The width it shows from.
 */
export function fitHandLabel(
  label: { readonly angle: number; readonly width: number },
  inner: number
): number | "none" {
  const from = TICK_BUCKETS.find((bucket) => {
    const radius = bucket / 2;
    return nearestPoint(handBox(label, radius)) >= inner * radius + GAP;
  });
  return from ?? "none";
}

/**
 * A hand label's box on a dial of a radius in CSS pixels: its middle on its ray at the rim less the
 * gap and its support along the ray, its box a whole line tall.
 */
function handBox(label: { readonly angle: number; readonly width: number }, radius: number): Box {
  const radians = (label.angle * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  const reach = radius - LABEL_GAP - (Math.abs(sin) * label.width) / 2 - (Math.abs(cos) * CAP) / 2;
  const x = sin * reach;
  const y = -cos * reach;
  return { left: x - label.width / 2, right: x + label.width / 2, top: y - LINE / 2, bottom: y + LINE / 2 };
}

/** How far a box's nearest point lies from the dial's centre, 0 when the box covers it. */
function nearestPoint(box: Box): number {
  return Math.hypot(Math.max(box.left, Math.min(0, box.right)), Math.max(box.top, Math.min(0, box.bottom)));
}

/** Whether a mark covers any of a chip's corners, edge middles or centre, the chip grown by the gap. */
function covered(chip: Box, marks: MarkCover | undefined, radius: number): boolean {
  if (marks === undefined) return false;
  const xs = [chip.left - GAP, (chip.left + chip.right) / 2, chip.right + GAP];
  const ys = [chip.top - GAP, (chip.top + chip.bottom) / 2, chip.bottom + GAP];
  return xs.some((x) => ys.some((y) => marks(x, y, radius)));
}

/** The cap height of 12 px chart text, about 0.73 em, which a label's support along its ray reads. */
const CAP = 8.75;

/**
 * An angle label's box on a dial of a radius in CSS pixels, as the axis places it: its middle on its
 * ray at the rim plus the gap and its support along the ray (Fix R4), its box a whole line tall.
 */
function angleBox(label: AngleObstacle, radius: number): Box {
  const radians = (label.angle * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  const reach = radius + LABEL_GAP + (Math.abs(sin) * label.width) / 2 + (Math.abs(cos) * CAP) / 2;
  const x = sin * reach;
  const y = -cos * reach;
  return { left: x - label.width / 2, right: x + label.width / 2, top: y - LINE / 2, bottom: y + LINE / 2 };
}

/** Whether two boxes come within the gap of each other. */
function meets(a: Box, b: Box): boolean {
  return a.left < b.right + GAP && a.right > b.left - GAP && a.top < b.bottom + GAP && a.bottom > b.top - GAP;
}

/** Whether the values a stride shows sit a line and a gap apart along the spoke. */
function spaced(rings: readonly RingLabel[], shows: readonly boolean[], radius: number): boolean {
  const shown = rings
    .flatMap((ring, index) => (shows[index] === true ? [ring.radius * radius] : []))
    .toSorted((a, b) => a - b);
  return shown.every((centre, index) => index === 0 || centre - (shown[index - 1] ?? 0) >= LINE + GAP);
}
