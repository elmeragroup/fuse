import { cn } from "../../styles/cn";
import { fieldBox } from "../../styles/field-box";

/** Input's field box and file-input classes, for an element that paints Input's look. */
export const inputClass = cn(
  fieldBox(),
  "file:text-sm file:font-medium min-w-0 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-foreground"
);
