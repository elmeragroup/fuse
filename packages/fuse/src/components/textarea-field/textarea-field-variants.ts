import { tv } from "../../styles/tv";

/**
 * The module-private recipe for the parts TextareaField adds to its FieldFrame. It is not
 * exported from `@elmeragroup/fuse/textarea-field`, and the workspace-only recipe catalog
 * re-exports it for the Figma component sync.
 *
 * - `labelRow` is added to the frame's label row, so the counter keeps 8px from the label.
 * - `counter` is the `current/max` character count at the row's end.
 */
export const textareaFieldVariants = tv({
  slots: {
    labelRow: "gap-2",
    counter: "text-xs text-muted-foreground",
  },
});
