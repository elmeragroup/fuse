/**
 * What the Input and Textarea sets share, since both draw Fuse's field box on a native control: a
 * placeholder and a typed value in six states, 12 cells, and the cell tests the field sets and
 * their compare cells read.
 *
 * - The box is 384px wide, the preview width its `w-full` takes, as the docs' widest field
 *   (`max-w-sm`) is.
 * - `content=placeholder` shows the control's placeholder, and `content=value` a typed value.
 * - The states are rest, focus, disabled, read-only, and invalid, where the control sits in an
 *   invalid Field. The field sets around a field box share these five. Input and Textarea add
 *   invalid focus, the invalid control with focus forced, where the recipe draws its error ring.
 */
import type { Cell } from "./component-spec";
import type { AxisSpec } from "./kit-spec";

/**
 * Whether a cell shows the placeholder, where the control holds a placeholder and no value.
 *
 * @param cell - The cell.
 * @returns True at `content=placeholder`.
 */
export function showsPlaceholder(cell: Cell): boolean {
  return cell.content === "placeholder";
}

/**
 * The widths a set's `width` axis draws its control at: hugging its content, then filling the
 * preview width, as a Field or a vertical group stretches it.
 */
export const HUG_OR_FILL = ["hug", "fill"] as const;

/**
 * Whether a cell's control fills its container's width.
 *
 * @param cell - A cell of a set with a `width` axis of {@link HUG_OR_FILL}.
 * @returns True at `width=fill`.
 */
export function fillsWidth(cell: Cell): boolean {
  return cell.width === "fill";
}

/** The states of a field box set, as the field sets around one draw it. */
const FIELD_BOX_STATES = ["rest", "focus", "disabled", "readonly", "invalid"] as const;

/** The matrix of a field box set: the placeholder or a value, in five states. */
export const FIELD_BOX_AXES: readonly AxisSpec[] = [
  { name: "content", values: ["placeholder", "value"] },
  { name: "state", values: FIELD_BOX_STATES },
];

/** The matrix of the Input and Textarea sets: the field box's, with invalid focus last. */
export const FIELD_CONTROL_AXES: readonly AxisSpec[] = [
  { name: "content", values: ["placeholder", "value"] },
  { name: "state", values: [...FIELD_BOX_STATES, "invalid-focus"] },
];
