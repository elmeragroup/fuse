import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of DateField segment rows. The rules every shell follows are in
// `corner-radius.ts`. Each constant pairs a part's rung or padding with the corner it publishes.

/**
 * A DateField's segment row. It pads the segments with the md control inset, inside the box border,
 * whether it paints the box itself or sits in a picker's.
 */
export const dateInputShellClass = cn(
  "[--shell-inner:max(0px,var(--field-corner)-1px-var(--control-px-md))]",
  publishShellBoundary
);
