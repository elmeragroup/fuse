import { cn } from "./cn";

/**
 * The range picker's root: a size container its two rows lay out by.
 */
export const pickerRangeRootClass = cn("@container/picker w-full");

/**
 * A calendar inside the picker's popover, which is already the card: it drops its own border,
 * shadow and fill, and keeps the popover's `--surface`.
 */
export const pickerPopupCalendarClass = cn(
  "border-none bg-transparent shadow-none [--surface-muted-foreground:inherit] [--surface:inherit]"
);

/**
 * RangeCalendar's root is bare and the popup pads nothing, so the grid would otherwise sit flush
 * against the popover border. It pads with the small surface tier, as Calendar's own shell does in
 * the single picker.
 */
export const pickerRangeCalendarClass = cn("p-(--surface-pad-sm)");

/**
 * The pane holding presets beside the calendar: stacked on a phone, side by side from `sm`. The
 * divider names the border role, the colour fuse.css's base-layer default gives every border, so the
 * role stays beside the divider. The pane takes no padding or gap, so the divider runs edge to edge
 * across the popover; the preset group and the calendar each carry their own inset.
 */
export const pickerPaneClass = cn(
  "sm:flex-row sm:divide-x sm:divide-y-0 flex flex-col divide-y divide-border"
);
