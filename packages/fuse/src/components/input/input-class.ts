import { cn } from "../../styles/cn";
import { fieldBox } from "../../styles/field-box";
import { fieldSize } from "../../styles/field-size";
import { tv } from "../../styles/tv";

/**
 * Input's field box and file-input classes, for an element that paints Input's look inside a box
 * that owns the field size, such as `InputGroup.Input` in `InputGroup.Root`. It writes no size, so
 * it reads the size of the box around it.
 */
export const inputClass = cn(
  fieldBox(),
  "file:text-sm file:font-medium min-w-0 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-foreground"
);

/**
 * Input's own field box: {@link inputClass} plus the field size it writes (`field-size.ts`).
 * `size` is `"default"`, the md control size, or `"sm"`, the sm control size.
 */
export const inputVariants = tv({
  base: inputClass,
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
