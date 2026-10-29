/**
 * One value reference's label on a vertical chart. Every such label aligns to the plot's inline
 * end, so two of them collide whenever their boxes share any height.
 */
export type ReferenceLabelEntry = {
  /** The label's place among the plot's labels when two share a value, such as its mount order. */
  readonly order: number;
  /** The label's own bottom edge as a share of the plot's height from its top, 0 to 100. */
  readonly at: number;
  /** Whether a band cut at the plot top labels below the cut, inside the band. */
  readonly clipped: boolean;
};

/** A label's own bottom edge, before any label above it pushes it down. */
function ownBottom(entry: ReferenceLabelEntry): string {
  return entry.clipped ? "calc(0.25rem + 1lh)" : `${String(entry.at)}%`;
}

/**
 * The bottom edge of one value reference label, as a CSS length against the plot's height. The
 * labels stack from the plot's top down in value order. Each label sits on its own line or band
 * edge unless the label before it reaches lower, and then it stacks just below that label, so no
 * two labels overlap. Where slot labels sit in a row above the plot, no label rises into it.
 *
 * @param entries - Every value reference label of the plot, the label itself included.
 * @param self - The label to place.
 * @returns The CSS `max()` of the label's own edge, each earlier label's edge plus one line per
 * label from it to this one, and one line per label up to this one under a slot label row.
 */
export function referenceLabelBottom(
  entries: readonly ReferenceLabelEntry[],
  self: ReferenceLabelEntry
): string {
  const ordered = [...entries].sort((a, b) => a.at - b.at || a.order - b.order);
  const index = ordered.indexOf(self);
  const before = index === -1 ? [] : ordered.slice(0, index);
  const terms = [
    ownBottom(self),
    ...before.map((entry, place) => `calc(${ownBottom(entry)} + ${String(before.length - place)}lh)`),
    // Under a row of slot labels above the plot, CSS sets the floor to 1, so the topmost label
    // stops one line under the plot's top and each label after it one more. Without that row the
    // floor is 0 and a label may sit above the plot's top edge.
    `calc(${String(before.length + 1)}lh * var(--chart-label-floor, 0))`,
  ];
  return `max(${terms.join(", ")})`;
}
