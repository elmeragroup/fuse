/**
 * Every part a `SkeletonReveal` draws differently from plain content declares a skeleton role,
 * keyed by its default `data-slot` like `PART_DENSITY` beside it. The skeleton draws from the real
 * component rendered with sample data, so it needs to know which parts are one shape and which
 * contain text it should draw line by line:
 *
 * - `block`: one bone at the part's border box, with the part's own corner radius. Controls,
 *   avatars, badges, switches and media read as one shape, whatever text or icons they contain.
 * - `ignore`: neither drawn nor walked, as for a spinner that only stands in for progress.
 *
 * A part without a role is a container. It keeps its own surface, such as a card's fill, border and
 * shadow, and the skeleton walks into it, drawing a bar per line of its text and a bone per block
 * inside it.
 *
 * Fuse declares its parts here instead of guessing what is painted, as a heuristic over computed
 * styles would. A Fuse part's shape is known when it is written, and the guess costs a
 * label-counting walk per painted element. Consumer markup takes the same roles through the
 * `data-skeleton` attribute, which wins over this table. Media and form elements are blocks by tag.
 *
 * A consumer's props or `render` element can replace a part's `data-slot`, so the skeleton does not
 * read the slot. Each part in the table writes `data-skeleton-part` with its name where a
 * consumer's props cannot replace it, and the skeleton looks that name up here. The
 * `fuse/skeleton-part-marker` lint rule requires the marker on every element that writes one of
 * these slots. A part whose tag already draws it as a block, such as `Textarea`, or that only
 * renders inside a block part, such as a Button's pending indicator, has no entry.
 */

/** How the skeleton draws one part: one block, or not at all. */
export type SkeletonRole = "block" | "ignore";

/** Every Fuse part with a skeleton role, keyed by its default `data-slot`. */
// oxlint-disable-next-line elmera/no-raw-class-map -- a role table, not classes: `block` is a role name
export const PART_SKELETON = {
  "attachment-media": "block",
  avatar: "block",
  badge: "block",
  button: "block",
  "card-section-media": "block",
  "chart-plot": "block",
  checkbox: "block",
  "combobox-trigger": "block",
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
  switch: "block",
  "timeline-list-mark": "block",
  toggle: "block",
  "toggle-group-item": "block",
  "toolbar-button": "block",
} as const satisfies Record<string, SkeletonRole>;

/** The tags the skeleton draws as one block, because they contain no text to measure or paint their own. */
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

/**
 * A Fuse part with a skeleton role, named by its default `data-slot`. The part writes its name where
 * a consumer's props cannot replace it, as `data-skeleton-part={"button" satisfies SkeletonPart}`.
 */
export type SkeletonPart = keyof typeof PART_SKELETON;

/** What the skeleton reads off one element to decide its role. */
export type SkeletonRoleSource = {
  /** The element's `data-skeleton` attribute, or `null` when it has none. */
  readonly hint: string | null;
  /** The element's `data-skeleton-part`, or `null` when it has none. */
  readonly part: string | null;
  /** The element's local name, such as `img` or `div`. */
  readonly tagName: string;
};

/** Whether a value names a skeleton role. */
function isSkeletonRole(value: string): value is SkeletonRole {
  return value === "block" || value === "ignore";
}

/** Whether a name is a part with a declared skeleton role. */
function isSkeletonPart(part: string): part is SkeletonPart {
  return Object.hasOwn(PART_SKELETON, part);
}

/**
 * The skeleton role of one element: its `data-skeleton` hint when that names a role, then the
 * role of the part its marker names, then `block` for a media or form tag. An element with none
 * of them is a container the skeleton walks into, reported as `undefined`.
 *
 * @param source - The element's hint, part marker and tag.
 * @returns The element's role, or `undefined` for a container.
 */
export function skeletonRoleOf(source: SkeletonRoleSource): SkeletonRole | undefined {
  if (source.hint !== null && isSkeletonRole(source.hint)) return source.hint;
  if (source.part !== null && isSkeletonPart(source.part)) return PART_SKELETON[source.part];
  return SKELETON_BLOCK_TAGS.has(source.tagName) ? "block" : undefined;
}
