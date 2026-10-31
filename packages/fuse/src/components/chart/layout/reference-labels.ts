/**
 * Where the value reference labels of a vertical chart sit, as a pure function of what their guides
 * draw in one frame. Every such label aligns to the plot's inline end and sits on its guide's edge,
 * so two labels collide whenever their guides lie closer than the lower label's height, and the
 * lower one stacks below the upper one.
 *
 * Placement is continuous in the drawn positions. Which label sits above another blends over one
 * device pixel of their edges' distance, and a label whose guide leaves the plot stops pushing the
 * others over one device pixel of its guide's travel. Labels on one edge stack in mount order. Two
 * labels can't stay apart while their guides cross, since at the crossing they meet, so the blend
 * is as narrow as the device allows: every resting edge sits on a whole device pixel, a cut area's
 * inset included, so labels at rest always stack apart, and a moving pair trades places in the
 * frame its guides cross.
 */

/** The size of one label, which its own text sets. */
export type LabelSize = {
  /** The label's height, one line of its text, in CSS pixels. */
  readonly height: number;
  /** How far inside a cut area the label comes to rest, in CSS pixels: 0.25rem and its line. */
  readonly inset: number;
};

/** One value reference's label, from what its guide draws now. */
export type LabelGuide = LabelSize & {
  /** A line's label sits on its line, and an area's slides inside the area as the plot cuts it. */
  readonly kind: "line" | "area";
  /** The label's mount order, which decides between two labels on one edge. */
  readonly order: number;
  /**
   * The drawn guide along the value axis, in CSS pixels from the plot's top and unclamped: a
   * line's edge twice, or an area's top and bottom edges.
   */
  readonly span: readonly [number, number];
};

/** The plot measurements placement reads, which every label shares. */
export type LabelPlot = {
  /**
   * The highest a label's box may reach, in CSS pixels from the plot's top: the plot's top under a
   * row of slot labels above it, and -Infinity without one, where a label may rise above the plot.
   */
  readonly start: number;
  /** The plot's drawn bottom edge, in CSS pixels from its top. */
  readonly end: number;
  /** One device pixel in CSS pixels, the grid every resting edge sits on and every blend's width. */
  readonly pixel: number;
};

/** A number clamped to the unit interval. */
function unit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * A label's own bottom edge before any other label pushes it. An area's label sits on the area's
 * top edge while that edge is in the plot, then slides down by as much as the edge has left the
 * plot, until it rests at its inset, rounded up to a whole device pixel so it rests on the grid.
 */
function ownEdge({ kind, span, inset }: LabelGuide, pixel: number): number {
  const edge = span[0];
  if (kind === "line") return edge;
  const resting = Math.ceil(inset / pixel - 1e-9) * pixel;
  return Math.max(edge, Math.min(-edge, resting));
}

/**
 * Place every label from its drawn guide.
 *
 * @param guides - Every value reference label of the plot, with its size and its drawn guide.
 * @param plot - The plot's drawn bottom edge and one device pixel.
 * @returns Each label's bottom edge in CSS pixels from the plot's top, in the order of `guides`.
 */
export function placeLabels(guides: readonly LabelGuide[], plot: LabelPlot): number[] {
  const { start, end, pixel } = plot;
  const blend = Math.max(pixel, 1e-6);
  const own = guides.map((guide) => ownEdge(guide, blend));
  const height = (index: number): number => guides[index]?.height ?? 0;
  // How much a label still takes part: fully while its guide reaches into the plot, fading over
  // one device pixel of its guide's travel beyond the plot's edge.
  const member = guides.map(({ span }) => unit(1 + (Math.min(span[1], end) - Math.max(span[0], 0)) / blend));
  // How much label j sits above label i: 1 when its edge lies higher, or on the same edge with an
  // earlier mount, and blending to 0 over one device pixel past the point where the two edges meet.
  const above = (j: number, i: number): number => {
    if (i === j) return 0;
    const earlier = (guides[j]?.order ?? 0) < (guides[i]?.order ?? 0) ? 1 : 0;
    return unit(((own[i] ?? 0) - (own[j] ?? 0)) / blend + earlier);
  };
  // The heights stacked from just below j down to i: i's own and every label between the two.
  const below = (j: number, i: number): number =>
    guides.reduce(
      (sum, _, m) =>
        m === i || m === j ? sum : sum + (member[m] ?? 0) * above(j, m) * above(m, i) * height(m),
      height(i)
    );
  return guides.map((_, i) => {
    const self = own[i] ?? 0;
    let bottom = self;
    let stacked = height(i);
    for (let j = 0; j < guides.length; j += 1) {
      const weight = (member[j] ?? 0) * above(j, i);
      if (weight === 0) continue;
      stacked += weight * height(j);
      // Label j pushes label i to j's edge plus the heights from just below j down to i, in the
      // share that j counts as above i.
      bottom = Math.max(bottom, self + weight * ((own[j] ?? 0) + below(j, i) - self));
    }
    // The highest box starts at the plot's start, and every label below it stacks under it.
    return Math.max(bottom, start + stacked);
  });
}
