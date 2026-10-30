import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Frame. The rules every shell follows are in `corner-radius.ts`.
// A Frame's items are the panels and Table containers that are its own: the root's direct
// children, and the direct children of a `Collapsible.Content` in a `Collapsible.Root` that is a
// direct child, so a collapsible panel is one of the Frame's items too. The root writes the corner
// its items take as the private `--frame-corner` onto its items only, through a selector that
// spells both paths, the `frame-item` variant in `frame-variants.css`. Every panel and Table
// container resets the property to `initial` at one-class specificity, and the root's item rule
// outweighs that reset, so only an item keeps a value. A panel or Table anywhere else, in a panel
// or a plain wrapper, resets it, so it never reaches them. Parts without a value fall back to
// `rounded-xl`.
//
// The root draws a 1px border, so an item sits its border and its padding inside the root's
// corner. A flush root has no padding, and its items pull 1px over its border, so their outer
// edge lies on the root's and they take the root's own `rounded-xl`. The root keys each layout on
// its `data-layout`, which it always writes.
//
// A panel rounds its top and bottom with two private properties, `--frame-panel-top-corner` and
// `--frame-panel-bottom-corner`, which default to its corner. Where the stacked and flush layouts
// fuse two adjacent panels, the root writes 0px into the corners that meet, so the panel, its
// highlight and a table it clips all square off at the seam together.
//
// Every text column in a Frame starts and ends on one inset from an item's outer edge, a panel's
// 1px border and its large surface tier. The root publishes it once, as the private
// `--frame-text-inset`, and the bars' share of it, `--frame-bar-inset`: the bars sit in the
// root's content box, which a flush root's items overhang by 1px, so a flush root's bars take 1px
// less. A framed Table's edge cells and caption pad with the inset itself, less a body cell's 1px
// edge border. A padless panel hands its padding to its Table's edge cells instead.

/**
 * The Frame root: `rounded-xl` behind a 1px border. The gutter and stacked layouts pad it with the
 * small surface tier, `--surface-pad-sm`, and hand its items the corner less the border and that
 * padding; the flush layout drops the padding and hands them its own `rounded-xl`. It publishes
 * its corner less its border and padding for any other inner part, such as a header's
 * collapsible trigger, squares the corners where the stacked and flush layouts fuse panels, and
 * publishes the text inset.
 */
export const frameShellClass = cn(
  "rounded-xl border p-(--surface-pad-sm) [--shell-inner:max(0px,--theme(--radius-xl)-1px-var(--surface-pad-sm))] data-[layout=flush]:p-0 data-[layout=flush]:[--shell-inner:max(0px,--theme(--radius-xl)-1px)]",
  "[--frame-bar-inset:var(--frame-text-inset)] [--frame-text-inset:calc(1px+var(--surface-pad-lg))] data-[layout=flush]:[--frame-bar-inset:calc(var(--frame-text-inset)-1px)]",
  "frame-item:[--frame-corner:max(0px,--theme(--radius-xl)-1px-var(--surface-pad-sm))] data-[layout=flush]:frame-item:[--frame-corner:--theme(--radius-xl)]",
  "not-data-[layout=gutter]:frame-seam-upper:[--frame-panel-bottom-corner:0px] not-data-[layout=gutter]:frame-seam-lower:[--frame-panel-top-corner:0px]",
  publishShellBoundary
);

/**
 * A Frame panel. As a Frame's item it rounds with the corner the Frame hands it, and elsewhere
 * with `rounded-xl`, through its top and bottom corners, `--frame-panel-top-corner` and
 * `--frame-panel-bottom-corner`. Its inset highlight rounds 1px inside them. It pads with the
 * large surface tier, `--surface-pad-lg`, and publishes its corner less its border and that
 * padding.
 *
 * A panel that `Frame.Panel` marks `data-sole-table="true"`, whose only child is a Table or a
 * `VerticalTable.Body`, holds no padding and publishes its corner less its border. The table's
 * box rounds 1px inside the panel's top and bottom corners and clips the table to them, a
 * `VerticalTable.Body` drops its own border for the panel's, and the first and last cells of each
 * row and the caption pad their outer side with the panel's padding, so their text lines up with
 * a padded panel's. Each corner is one utility per side, so a consumer's `rounded-*` or
 * `before:rounded-*` class replaces them.
 */
export const framePanelShellClass = cn(
  "rounded-t-(--frame-panel-top-corner) rounded-b-(--frame-panel-bottom-corner) border p-(--surface-pad-lg) [--frame-corner:initial] [--frame-panel-bottom-corner:var(--frame-corner,--theme(--radius-xl))] [--frame-panel-top-corner:var(--frame-corner,--theme(--radius-xl))] [--shell-inner:max(0px,var(--frame-corner,--theme(--radius-xl))-1px-var(--surface-pad-lg))] before:rounded-t-[max(0px,var(--frame-panel-top-corner)-1px)] before:rounded-b-[max(0px,var(--frame-panel-bottom-corner)-1px)]",
  "data-[sole-table=true]:p-0 data-[sole-table=true]:[--shell-inner:max(0px,var(--frame-corner,--theme(--radius-xl))-1px)] data-[sole-table=true]:*:rounded-t-[max(0px,var(--frame-panel-top-corner)-1px)] data-[sole-table=true]:*:rounded-b-[max(0px,var(--frame-panel-bottom-corner)-1px)] data-[sole-table=true]:*:data-[slot=vertical-table]:border-0",
  "data-[sole-table=true]:frame-panel-table-row:*:first:ps-(--surface-pad-lg) data-[sole-table=true]:frame-panel-table-row:*:last:pe-(--surface-pad-lg) data-[sole-table=true]:frame-panel-table-caption:px-(--surface-pad-lg) data-[sole-table=true]:frame-panel-table-caption:text-start",
  publishShellBoundary
);

/**
 * A Table's container. It resets `--frame-corner` unless it is a Frame's item, so its body reads
 * only the corner its own Frame hands it.
 */
export const frameTableContainerShellClass = cn("[--frame-corner:initial]");

/**
 * A framed Table's body, which paints as a panel: it and its corner cells round with the corner
 * its container holds, or `rounded-xl`, and its inset highlight sits 1px inside. Its edge cells
 * draw a 1px edge border, so they pad the Frame's text inset less that border.
 */
export const frameTableBodyShellClass = cn(
  "before:rounded-[max(0px,calc(var(--frame-corner,--theme(--radius-xl))-1px))] framed-table:rounded-[var(--frame-corner,--theme(--radius-xl))] framed-table:*:[tr]:first:*:[td]:first:rounded-ss-[var(--frame-corner,--theme(--radius-xl))] framed-table:*:[tr]:*:[td]:first:ps-[calc(var(--frame-text-inset)-1px)] framed-table:*:[tr]:last:*:[td]:last:rounded-ee-[var(--frame-corner,--theme(--radius-xl))] framed-table:*:[tr]:*:[td]:last:pe-[calc(var(--frame-text-inset)-1px)] framed-table:*:[tr]:first:*:[td]:last:rounded-se-[var(--frame-corner,--theme(--radius-xl))] framed-table:*:[tr]:last:*:[td]:first:rounded-es-[var(--frame-corner,--theme(--radius-xl))]"
);
