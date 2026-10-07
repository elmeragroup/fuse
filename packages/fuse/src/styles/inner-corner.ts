import { tv } from "tailwind-variants";

import { cn } from "./cn";

/**
 * The shells that publish `--inner-corner`, one slot per shell part. Each shell keeps its outer
 * rung and its publisher here, so the two cannot drift. A part that rounds sets the shell's
 * `rounded-*` rung. A part that pads its inner parts sets the padding and publishes the rung
 * less that padding, read through `--theme()` so it resolves in the shell's own theme scope.
 * A shell that rounds and pads on one element has both in one slot. The contract and the
 * concentric rule are in `corner-radius.ts`.
 *
 * Every shell boundary, a popup root or a padded part, states the whole corner state, so no value
 * from an outer shell crosses it. It writes its post-padding corner to a private `--shell-inner`,
 * or `initial` when the part does not publish a corner, and aliases the public `--inner-corner` to
 * it. A popup root also sets the private `--shell-corner` relay to its own rung, or `initial` when
 * no nested shell reads it. Nested shells relay through these: a padded part subtracts its padding
 * from the inherited `--shell-corner`, and the boundary that opens a nested shell inside it sets
 * `--shell-corner` from the inherited `--shell-inner`, which a ThemeScope reset leaves alone. No
 * custom property depends on itself, directly or indirectly, on one element, so any depth
 * subtracts each padding once. Where no shell is above a padded part, `--shell-corner` is
 * undefined, its `--inner-corner` is invalid at computed-value time, and `rounded-inner` falls
 * back to `--radius`. NavigationMenu relays to its inline panels this way, and Frame will relay to
 * its panels.
 *
 * Tailwind generates a class only from its whole literal, so each slot spells its values.
 */

/** The public corner every boundary publishes: its private post-padding corner. */
const publishInnerCorner = cn("[--inner-corner:var(--shell-inner)]");

const innerCornerShellVariants = tv({
  slots: {
    /** DropdownMenu Content and SubContent: the popup rounds, pads 4px and publishes. */
    menuPopup: [
      "rounded-md p-1 [--shell-corner:initial] [--shell-inner:max(0px,--theme(--radius-md)-var(--spacing))]",
      publishInnerCorner,
    ],
    /** The Combobox popup. It publishes no corner; its List pads the rows and publishes. */
    listboxPopup: ["rounded-md [--shell-corner:initial] [--shell-inner:initial]", publishInnerCorner],
    /**
     * `Combobox.List`: pads its rows 4px inside the {@link listboxPopup} corner and publishes.
     * An empty List drops its padding, so it publishes the popup's rung at zero inset.
     */
    listboxList: [
      "p-1 [--shell-inner:max(0px,--theme(--radius-md)-var(--spacing))] data-empty:p-0 data-empty:[--shell-inner:--theme(--radius-md)]",
      publishInnerCorner,
    ],
    /**
     * The Select popup. It has no padding, so a row outside a group meets its corner and the
     * popup publishes the rung itself.
     */
    selectPopup: [
      "rounded-lg [--shell-corner:initial] [--shell-inner:--theme(--radius-lg)]",
      publishInnerCorner,
    ],
    /** `Select.Group`: pads its rows 4px inside the {@link selectPopup} corner and publishes. */
    selectGroup: ["p-1 [--shell-inner:max(0px,--theme(--radius-lg)-var(--spacing))]", publishInnerCorner],
    /**
     * The NavigationMenu popup. It publishes no corner and starts the `--shell-corner` relay at its
     * own rung for its Content.
     */
    navigationPopup: [
      "rounded-md [--shell-corner:--theme(--radius-md)] [--shell-inner:initial]",
      publishInnerCorner,
    ],
    /**
     * `NavigationMenu.Content`: pads its rows 8px inside the relayed `--shell-corner` and
     * publishes. Outside a popup no corner is relayed, so it publishes nothing.
     */
    navigationContent: [
      "p-2 [--shell-inner:max(0px,var(--shell-corner)-2*var(--spacing))]",
      publishInnerCorner,
    ],
    /**
     * The `NavigationMenu.Viewport` of an inline Root. Nested in a Content, it relays that
     * Content's `--shell-inner` as the corner its own Content pads inside. It has no padding or
     * border of its own.
     */
    navigationInlineViewport: "[--shell-corner:var(--shell-inner)]",
  },
});

/**
 * The class of each shell part that rounds or publishes `--inner-corner`. The recipe has no
 * axes, so each slot resolves once at module scope where a component reads it.
 */
export const innerCornerShell = innerCornerShellVariants();
