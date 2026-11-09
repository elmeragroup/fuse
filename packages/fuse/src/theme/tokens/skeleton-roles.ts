/**
 * Every part a `SkeletonReveal` draws differently from plain content declares a skeleton role,
 * keyed by its `data-slot` like `PART_DENSITY` beside it. The skeleton is drawn from the real
 * component rendered with sample data, so it needs to know which parts are one shape and which
 * hold text it should draw line by line:
 *
 * - `block`: one bone at the part's border box, with the part's own corner radius. Controls,
 *   avatars, badges, switches and media read as one shape, whatever text or icons they hold.
 * - `ignore`: neither drawn nor walked, as for a spinner that only stands in for progress.
 *
 * A part without a role is a container: it keeps its own surface (a card's fill, border and
 * shadow), and the skeleton walks into it, drawing a bar per line of its text and a bone per
 * block inside it.
 *
 * Fuse declares its parts here instead of guessing what is painted, as a heuristic over
 * computed styles would: a Fuse part's shape is known when it is written, and the guess costs a
 * label-counting walk per painted element. Consumer markup takes the same roles through the
 * `data-skeleton` attribute, which wins over this table; media and form elements are blocks by
 * tag.
 */

/** How the skeleton draws one part: one block, or not at all. */
export type SkeletonRole = "block" | "ignore";

/** Every Fuse part with a skeleton role, keyed by `data-slot`. */
// oxlint-disable-next-line elmera/no-raw-class-map -- a role table, not classes: `block` is a role name
export const PART_SKELETON = {
  "attachment-media": "block",
  avatar: "block",
  badge: "block",
  button: "block",
  "button-pending-indicator": "ignore",
  "card-section-media": "block",
  "chart-plot": "block",
  checkbox: "block",
  "combobox-trigger": "block",
  emoji: "block",
  "empty-media": "block",
  input: "block",
  "input-group": "block",
  "item-media": "block",
  kbd: "block",
  loader: "ignore",
  "meter-bar": "block",
  "pagination-link": "block",
  "radio-group-item": "block",
  "select-trigger": "block",
  skeleton: "block",
  slider: "block",
  sparkline: "block",
  switch: "block",
  textarea: "block",
  "timeline-list-dot": "block",
  toggle: "block",
  "toggle-group-item": "block",
  "toolbar-button": "block",
} as const satisfies Record<string, SkeletonRole>;

/** Elements drawn as one block by tag: they hold no text to measure, or paint their own. */
const SKELETON_BLOCK_TAGS: ReadonlySet<string> = new Set([
  "audio",
  "canvas",
  "embed",
  "iframe",
  "img",
  "input",
  "object",
  "picture",
  "select",
  "svg",
  "textarea",
  "video",
]);

/** What the skeleton reads off one element to decide its role. */
export type SkeletonRoleSource = {
  /** The element's `data-skeleton` attribute, or null when it has none. */
  readonly hint: string | null;
  /** The element's `data-slot`, or null when it has none. */
  readonly slot: string | null;
  /** The element's local name, such as `img` or `div`. */
  readonly tagName: string;
};

/** Whether a value names a skeleton role. */
function isSkeletonRole(value: string): value is SkeletonRole {
  return value === "block" || value === "ignore";
}

/** Whether a slot has a declared skeleton role. */
function isSkeletonPart(slot: string): slot is keyof typeof PART_SKELETON {
  return Object.hasOwn(PART_SKELETON, slot);
}

/**
 * The skeleton role of one element: its `data-skeleton` hint when that names a role, then its
 * slot's role, then `block` for a media or form tag. An element with none of them is a
 * container the skeleton walks into, reported as `undefined`.
 *
 * @param source - The element's hint, slot and tag.
 * @returns The element's role, or `undefined` for a container.
 */
export function skeletonRoleOf(source: SkeletonRoleSource): SkeletonRole | undefined {
  if (source.hint !== null && isSkeletonRole(source.hint)) return source.hint;
  if (source.slot !== null && isSkeletonPart(source.slot)) return PART_SKELETON[source.slot];
  return SKELETON_BLOCK_TAGS.has(source.tagName) ? "block" : undefined;
}
