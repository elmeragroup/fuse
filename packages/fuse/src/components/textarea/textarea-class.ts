import { cn } from "../../styles/cn";
import { fieldBox } from "../../styles/field-box";
import { fieldSize } from "../../styles/field-size";
import { tv } from "../../styles/tv";

/**
 * Textarea's field box: at least 64px tall, growing with its text through `field-sizing-content`.
 * It writes no size, so inside `InputGroup.Root` it reads the group's.
 */
export const textareaClass = cn(fieldBox({ box: "content" }), "flex field-sizing-content");

/**
 * Textarea's own field box: {@link textareaClass} plus the field size it writes (`field-size.ts`).
 * `size` is `"default"`, the md control size, or `"sm"`, the sm control size; it sets the inset and
 * the type, and the box keeps its content-grown height.
 */
export const textareaVariants = tv({
  base: textareaClass,
  variants: {
    size: {
      default: fieldSize({ size: "default" }).box(),
      sm: fieldSize({ size: "sm" }).box(),
    },
  },
  defaultVariants: {
    size: "default",
  },
});
