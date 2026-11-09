import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of the React Aria popover and dialog and the date pickers. The rules
// every shell follows are in `corner-radius.ts`. Each constant pairs a part's rung or padding with
// the corner it publishes.

/**
 * The React Aria popover: `rounded-md` behind a 1px border.
 */
export const racPopoverShellClass = cn(
  "rounded-md border [--shell-inner:max(0px,--theme(--radius-md)-1px)]",
  publishShellBoundary
);

/**
 * The React Aria dialog, which pads nothing: the calendar and presets inside it pad themselves
 * with the small surface tier. In a popover it publishes the popover's corner inside its 1px
 * border. Outside one it is no rounded shell, so it publishes no corner.
 */
export const racDialogShellClass = cn(
  "[--shell-inner:initial] [[data-placement]>&]:[--shell-inner:max(0px,--theme(--radius-md)-1px)]",
  publishShellBoundary
);

/**
 * The date pickers' preset group: the small surface tier, `--surface-pad-sm`, inside the popover's
 * corner and border.
 */
export const pickerPresetsShellClass = cn(
  "p-(--surface-pad-sm) [--shell-inner:max(0px,--theme(--radius-md)-1px-var(--surface-pad-sm))]",
  publishShellBoundary
);
