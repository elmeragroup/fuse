import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Frame. The rules every shell follows are in `corner-radius.ts`.
// The Frame root writes the corner its direct children take, its `rounded-xl` less its 4px
// padding, as the private `--frame-corner` onto those children only. Every panel and Table
// container resets the property to `initial` at one-class specificity, and the root's
// direct-child rule outweighs that reset, so only a Frame's direct child keeps a value. A nested
// panel or Table resets it again, so it never reaches them, and the panel's highlight inherits
// its panel's value. Parts without a value fall back to `rounded-xl`.

/**
 * The Frame root: `rounded-xl` and 4px padding. It hands its direct panels and table containers
 * the corner they take, and publishes the same value for any other inner part.
 */
export const frameShellClass = cn(
  "rounded-xl p-1 [--shell-inner:max(0px,--theme(--radius-xl)-var(--spacing))] *:data-[slot=frame-panel]:[--frame-corner:max(0px,--theme(--radius-xl)-var(--spacing))] *:data-[slot=table-container]:[--frame-corner:max(0px,--theme(--radius-xl)-var(--spacing))]",
  publishShellBoundary
);

/**
 * A Frame panel. As a Frame's direct child it rounds with the corner the Frame hands it, and
 * elsewhere with `rounded-xl`. Its inset highlight sits 1px inside that corner, and it publishes
 * the corner less its border and 20px padding. Each corner is one utility, so a consumer's
 * `rounded-*` or `before:rounded-*` class replaces it.
 */
export const framePanelShellClass = cn(
  "rounded-[var(--frame-corner,--theme(--radius-xl))] border p-5 [--frame-corner:initial] [--shell-inner:max(0px,var(--frame-corner,--theme(--radius-xl))-1px-5*var(--spacing))] before:rounded-[max(0px,calc(var(--frame-corner,--theme(--radius-xl))-1px))]",
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
