import { cn } from "../cn";
import { fieldCornerClass, publishShellBoundary } from "../corner-radius";

// The inner-corner shells of every field box. The rules every shell follows are in
// `corner-radius.ts`. Each constant pairs a part's rung or padding with the corner it publishes.

/**
 * Every field box: the field corner, published less the 1px border.
 */
export const fieldBoxShellClass = cn(
  fieldCornerClass,
  "[--shell-inner:max(0px,var(--field-corner)-1px)]",
  publishShellBoundary
);
