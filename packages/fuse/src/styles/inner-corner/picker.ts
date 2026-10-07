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
 * The React Aria dialog. In a popover it pads 16px inside the popover's corner and border. Outside
 * one it is no rounded shell, so it publishes no corner.
 */
export const racDialogShellClass = cn(
  "p-6 [--shell-inner:initial] [[data-placement]>&]:p-4 [[data-placement]>&]:[--shell-inner:max(0px,--theme(--radius-md)-1px-4*var(--spacing))]",
  publishShellBoundary
);

/**
 * The date pickers' dialog, which pads nothing inside the popover.
 */
export const pickerDialogShellClass = cn(
  "p-0 [[data-placement]>&]:p-0 [[data-placement]>&]:[--shell-inner:max(0px,--theme(--radius-md)-1px)]",
  publishShellBoundary
);

/**
 * The date pickers' preset group: 8px inside the popover's corner and border.
 */
export const pickerPresetsShellClass = cn(
  "p-2 [--shell-inner:max(0px,--theme(--radius-md)-1px-2*var(--spacing))]",
  publishShellBoundary
);
