import { cn } from "./cn";

/**
 * The open/close height transition shared by `Collapsible.Content` and `Accordion.Content`.
 * One constant because the only difference between the two is which Base UI variable
 * carries the measured panel height, which each call site appends as
 * `h-(--…-panel-height)`.
 *
 * It keys the collapsed state on `data-starting-style` / `data-ending-style`, never on
 * `data-open`. Base UI takes `data-open` straight from the `open` state, while the ending
 * frame is deferred through `useTransitionStatus` in `useCollapsiblePanel`, so a close
 * request drops `data-open` in the same render; by the time the panel starts animating,
 * Base UI has reset `--…-panel-height` to `auto`, and `auto → 0px` is not interpolable —
 * the panel snaps instead of transitioning. The starting/ending frames are the ones Base UI
 * exposes for this purpose, including for a `hiddenUntilFound` panel, which keeps
 * `data-starting-style` while hidden so this rule holds it at zero.
 *
 * Consumers merge their `className` after this constant, so their conflicting utility wins.
 * The central reduced-motion rule (`fuse.css`) strips `height` from `transition-property`.
 */
export const panelHeightTransition = cn(
  "ease-out overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0"
);
