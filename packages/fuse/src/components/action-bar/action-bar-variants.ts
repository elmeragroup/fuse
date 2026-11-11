import { cn } from "../../styles/cn";
import { tv } from "../../styles/tv";
import { actionBarLayer } from "../overlay/overlay-classes";
import { toolbarVariants } from "../toolbar/toolbar-variants";

const toolbar = toolbarVariants();

/**
 * The module-private recipe for ActionBar. It is not exported from
 * `@elmeragroup/fuse/action-bar`; the workspace-only recipe catalog re-exports it for the Figma
 * component sync.
 *
 * - `positioner` spans the bottom of the nearest positioned ancestor, `--action-bar-offset` up from
 *   its bottom edge (Root's `offset`) and 16px in from each side, and
 *   centres the bar in it. It lets the pointer through to the content beside the bar, and it is
 *   the `action-bar` query container that `buttonLabel` reads, since the bar itself shrinks to its
 *   items. Its layer is `actionBarLayer`, above the content's sticky headers and scrollbars and
 *   below the overlay layer, so a menu or dialog the bar opens covers it.
 * - `root` is Toolbar's bar, raised with `shadow-lg`. It rises 6px and fades in on
 *   `data-starting-style` and falls back on `data-ending-style`, in one 150ms ease-out
 *   transition of opacity and translate. Under reduced motion it only fades: the translate and
 *   its transition are declared under `motion-safe:`.
 * - `count` is the selection count, kept on one line in tabular figures so the bar does not
 *   reflow as the count changes.
 * - `buttonLabel` is a button's words, visually hidden while the positioner is narrower than
 *   28rem, so a narrow bar keeps its icons and each button keeps its accessible name.
 * - `separator` is Toolbar's separator.
 */
export const actionBarVariants = tv({
  slots: {
    positioner: cn(
      "@container/action-bar pointer-events-none absolute inset-x-0 bottom-(--action-bar-offset) flex justify-center px-4",
      actionBarLayer
    ),
    root: cn(
      toolbar.root(),
      "shadow-lg ease-out pointer-events-auto max-w-full opacity-100 transition-opacity duration-150",
      "data-ending-style:opacity-0 data-starting-style:opacity-0",
      // Movement sits under no-preference, as the central reduced-motion rule asks: that rule only
      // drops `translate` from the transition, so a translated end state would still jump.
      "motion-safe:transition-[opacity,translate] motion-safe:data-ending-style:translate-y-1.5 motion-safe:data-starting-style:translate-y-1.5"
    ),
    count: "text-xs font-medium px-2 whitespace-nowrap tabular-nums",
    buttonLabel: "@max-md/action-bar:sr-only",
    separator: toolbar.separator(),
  },
});
