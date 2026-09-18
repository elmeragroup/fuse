import { tv } from "tailwind-variants";

/**
 * The open/close height transition shared by `Collapsible.Content` and `Accordion.Content`.
 * One recipe because the only difference between the two is which Base UI variable carries
 * the measured panel height.
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
 * Consumers merge their `className` after this recipe, so their conflicting utility wins.
 * The central reduced-motion rule (`ui.css`) strips `height` from `transition-property`.
 */
export const panelHeight = tv({
  // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- collapsed panel height, not a control-box rung
  base: "ease-out overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0",
  variants: {
    panel: {
      collapsible: "h-(--collapsible-panel-height)",
      accordion: "h-(--accordion-panel-height)",
    },
  },
  // Required shape: component-authoring.md makes every recipe with an axis declare
  // `defaultVariants`. There is no default panel — both call sites pass the axis.
  defaultVariants: {},
});
