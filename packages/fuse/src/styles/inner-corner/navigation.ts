import { cn } from "../cn";
import { publishInnerCorner } from "../corner-radius";

// The inner-corner shells of NavigationMenu, which relays its corner to inline panels. The rules
// every shell follows are in `corner-radius.ts`. Each constant pairs a part's rung or padding with
// the corner it publishes.

/**
 * The NavigationMenu popup. It publishes no corner and starts the `--shell-corner` relay at its own
 * rung for its Content.
 */
export const navigationPopupShellClass = cn(
  "rounded-md [--shell-corner:--theme(--radius-md)] [--shell-inner:initial]",
  publishInnerCorner
);

/**
 * `NavigationMenu.Content`: pads its rows with the small surface tier, `--surface-pad-sm`, inside
 * the relayed `--shell-corner` and publishes. It
 * preserves the relay. Outside a popup no corner is relayed, so it publishes nothing.
 */
export const navigationContentShellClass = cn(
  "p-(--surface-pad-sm) [--shell-inner:max(0px,var(--shell-corner)-var(--surface-pad-sm))]",
  publishInnerCorner
);

/**
 * The `NavigationMenu.Viewport` of an inline Root. Nested in a Content, it relays that Content's
 * `--shell-inner` as the corner its own Content pads inside. It has no padding or border of its
 * own.
 */
export const navigationInlineViewportShellClass = cn("[--shell-corner:var(--shell-inner)]");
