import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Frame. The rules every shell follows are in `corner-radius.ts`.
// The Frame root writes the corner its direct children take, its `rounded-xl` less its small
// surface padding, as the private `--frame-corner` onto those children only. Every panel and Table
// container resets the property to `initial` at one-class specificity, and the root's
// direct-child rule outweighs that reset, so only a Frame's direct child keeps a value. A nested
// panel or Table resets it again, so it never reaches them, and the panel's highlight inherits
// its panel's value. Parts without a value fall back to `rounded-xl`.

/**
 * The Frame root: `rounded-xl` and the small surface padding, `--surface-pad-sm`. It hands its direct panels and table containers
 * the corner they take, and publishes the same value for any other inner part.
 */
export const frameShellClass = cn(
  "rounded-xl p-(--surface-pad-sm) [--shell-inner:max(0px,--theme(--radius-xl)-var(--surface-pad-sm))] *:data-[slot=frame-panel]:[--frame-corner:max(0px,--theme(--radius-xl)-var(--surface-pad-sm))] *:data-[slot=table-container]:[--frame-corner:max(0px,--theme(--radius-xl)-var(--surface-pad-sm))]",
  publishShellBoundary
);

/**
 * A Frame panel. As a Frame's direct child it rounds with the corner the Frame hands it, and
 * elsewhere with `rounded-xl`. Its inset highlight sits 1px inside that corner, and it publishes
 * the corner less its border and the large surface padding, `--surface-pad-lg`. Each corner is one utility, so a consumer's
 * `rounded-*` or `before:rounded-*` class replaces it.
 */
export const framePanelShellClass = cn(
  "rounded-[var(--frame-corner,--theme(--radius-xl))] border p-(--surface-pad-lg) [--frame-corner:initial] [--shell-inner:max(0px,var(--frame-corner,--theme(--radius-xl))-1px-var(--surface-pad-lg))] before:rounded-[max(0px,calc(var(--frame-corner,--theme(--radius-xl))-1px))]",
  publishShellBoundary
);

/**
 * A Table's container. It resets `--frame-corner` unless it is a Frame's direct child, so its
 * body reads only the corner its own Frame hands it.
 */
export const frameTableContainerShellClass = cn("[--frame-corner:initial]");

/**
 * A Table body in a Frame, which paints as a panel: it and its corner cells round with the
 * corner its container holds, or `rounded-xl`, and its inset highlight sits 1px inside.
 */
export const frameTableBodyShellClass = cn(
  "before:rounded-[max(0px,calc(var(--frame-corner,--theme(--radius-xl))-1px))] in-data-[slot=frame]:rounded-[var(--frame-corner,--theme(--radius-xl))] in-data-[slot=frame]:*:[tr]:first:*:[td]:first:rounded-ss-[var(--frame-corner,--theme(--radius-xl))] in-data-[slot=frame]:*:[tr]:last:*:[td]:last:rounded-ee-[var(--frame-corner,--theme(--radius-xl))] in-data-[slot=frame]:*:[tr]:first:*:[td]:last:rounded-se-[var(--frame-corner,--theme(--radius-xl))] in-data-[slot=frame]:*:[tr]:last:*:[td]:first:rounded-es-[var(--frame-corner,--theme(--radius-xl))]"
);
