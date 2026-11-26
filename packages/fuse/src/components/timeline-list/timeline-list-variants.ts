/**
 * The module-private recipe for TimelineList's parts. The public entry does not export it, because
 * no other component borrows it.
 *
 * An Item in a plain vertical list is a flex row of the rail, a lane wide, and the content, which
 * takes the rest. Every other Item is a grid whose cells take fixed area names, `opposite`, `rail`
 * and `content`: a vertical list with an opposite cell and an alternate list lay them out with
 * `grid-template-areas`, so swapping sides on even Items or stacking the date in the fold is a
 * template change, and a horizontal Item places them on the Root's named rows through a row
 * subgrid. An Item without an opposite cell keeps its rail where its neighbors have theirs. The
 * Figma kit draws the plain vertical layout, and its build maps neither a grid whose items place
 * themselves nor one whose row a stretched rail and a cell of editable text share, in
 * `packages/fuse-figma/src/components/grid-layout.ts`.
 *
 * The rail is a flex box along the direction of travel: the incoming connector, the indicator and
 * the outgoing connector, which takes the rest. The gap around a mark is a margin on the indicator,
 * so a rail without one draws an unbroken line. The first incoming and the last outgoing connector
 * keep their space and paint nothing, through `opacity: 0`, which forced-colors mode keeps.
 *
 * The Root sets the values several parts share: `--timeline-line`, the 22px line of a Title from
 * level 3 down, `text-base leading-snug`; `--timeline-mark`, the lane size; `--timeline-gap`, the
 * rail gap; `--timeline-space`, the space between Items; and `--timeline-lead`, the distance from
 * an Item's start to its mark's center, `max(line / 2, mark / 2 + gap)`. The text cells start
 * `lead - line / 2` down, and the incoming connector is `lead - drawn / 2 - gap` long, where
 * `drawn` is the length of the mark the Item draws along the rail: the lane, or the 8.75px default
 * dot an Item without `status` or `indicator` keeps. The mark's center is then the first text
 * line's center, and the gap on both sides of it is `gap`. Every other length sits on the part that
 * uses it, under the layout variants in `styles/timeline-list-variants.css`, which match a part by
 * its own list, so a list nested in an Item's content keeps its own layout and lane.
 *
 * - A horizontal list is the grid that owns the rows, and each Item spans them with a row
 *   subgrid, so a date that wraps moves every rail alike. Below Chrome 117 each Item lays out its
 *   own rows, the rail first, so the track stays straight.
 * - Only an alternate list is a container. Under 32rem its Items fold to one side; an Item with an
 *   opposite cell stacks it above the body, and the leading offset goes on the opposite cell.
 * - An opposite cell takes the Title's line height for bare text, and so does a direct
 *   `TimelineList.Time`, in place of its 20px, so the date's first line centers on the mark as the
 *   title's does. Other children keep their own line height. A `::first-line` rule would leave later
 *   lines alone, but Chromium does not apply its line height to a block child.
 *
 * Marks draw through `mark-fill-*` and borders, which forced-colors mode paints in `CanvasText`. A
 * glyph on a filled mark takes `Canvas` there, so it stays visible on the `CanvasText` fill. Each
 * status has its own silhouette at dot size: a filled circle, a ring around a dot, a ring, and a
 * rotated square. The Item renders the check and the cross whatever the size; the Root's
 * `--timeline-glyph` hides them at dot size, and its `--timeline-error-*` properties turn the error
 * circle into the rotated square there.
 */
import { tv } from "../../styles/tv";

export const timelineListVariants = tv({
  slots: {
    root: [
      "m-0 p-0",
      "[--timeline-dot:8.75px] [--timeline-gap:--spacing(1)] [--timeline-line:calc(var(--text-base)*var(--leading-snug))]",
      "[--timeline-lead:max(calc(var(--timeline-line)/2),calc(var(--timeline-mark)/2+var(--timeline-gap)))]",
      "[--timeline-error-radius:calc(infinity*1px)] [--timeline-error-rotate:0deg] [--timeline-error-size:var(--timeline-mark)] [--timeline-glyph:block] [--timeline-halo:2px]",
    ],
    item: [
      "flex gap-x-3",
      // The Item's own lengths, which its cells and rail parts read: the space after it, none for
      // the last; the horizontal start inset of its text and mark, none for the first; and how far
      // the mark it draws reaches back along the rail from its center, half its length and the gap.
      "[--timeline-inset:0px] [--timeline-trail:var(--timeline-space)] last:[--timeline-trail:0px] timeline-list-horizontal:[--timeline-inset:var(--timeline-gap)] timeline-list-horizontal:first:[--timeline-inset:0px]",
      "[--timeline-reach:calc(var(--timeline-drawn)/2+var(--timeline-gap))]",
      "timeline-list-opposite:grid timeline-list-opposite:grid-cols-[7rem_var(--timeline-mark)_minmax(0,1fr)] timeline-list-opposite:[grid-template-areas:'opposite_rail_content']",
      // Alternate, wide: the body and the opposite cell on either side of the rail, swapped on even
      // Items.
      "timeline-list-alternate:grid timeline-list-alternate:@min-[32rem]/timeline-list:grid-cols-[minmax(0,1fr)_var(--timeline-mark)_minmax(0,1fr)]",
      "timeline-list-alternate:@min-[32rem]/timeline-list:[grid-template-areas:'opposite_rail_content'] timeline-list-alternate:@min-[32rem]/timeline-list:even:[grid-template-areas:'content_rail_opposite']",
      // Alternate, folded: one side. An Item with an opposite cell stacks it above the body, with the
      // rail beside both; one without keeps a single row.
      "timeline-list-alternate:@max-[32rem]/timeline-list:grid-cols-[var(--timeline-mark)_minmax(0,1fr)] timeline-list-alternate:@max-[32rem]/timeline-list:[grid-template-areas:'rail_content']",
      "timeline-list-alternate:@max-[32rem]/timeline-list:timeline-list-dated:[grid-template-areas:'rail_opposite'_'rail_content']",
      // Horizontal: each Item spans the Root's named rows.
      "timeline-list-horizontal:row-span-full timeline-list-horizontal:grid timeline-list-horizontal:grid-cols-[minmax(0,1fr)] timeline-list-horizontal:grid-rows-subgrid timeline-list-horizontal:gap-x-0",
      "timeline-list-horizontal:supports-[not(grid-template-rows:subgrid)]:grid-rows-[[rail]_auto_[opposite]_auto_[content]_1fr]",
    ],
    opposite: [
      "min-w-0 [grid-area:opposite] timeline-list-horizontal-cell:max-w-64 timeline-list-horizontal-cell:[grid-area:opposite/1]",
      "text-end timeline-list-alternate-cell:@max-[32rem]/timeline-list:text-start timeline-list-even-cell:@min-[32rem]/timeline-list:text-start timeline-list-horizontal-cell:text-start",
      "leading-(--timeline-line) wrap-anywhere [&>[data-slot=timeline-list-time]]:leading-(--timeline-line)",
      "pbs-[calc(var(--timeline-lead)-var(--timeline-line)/2)] pbe-(--timeline-trail) timeline-list-alternate-cell:@max-[32rem]/timeline-list:pbe-0",
      "timeline-list-horizontal-cell:ps-(--timeline-inset) timeline-list-horizontal-cell:pe-(--timeline-trail) timeline-list-horizontal-cell:pbs-2 timeline-list-horizontal-cell:pbe-2",
    ],
    rail: [
      "flex w-(--timeline-mark) shrink-0 flex-col items-center timeline-list-placed:[grid-area:rail] timeline-list-horizontal-cell:[grid-area:rail/1]",
      "timeline-list-horizontal-cell:h-(--timeline-mark) timeline-list-horizontal-cell:w-auto timeline-list-horizontal-cell:flex-row",
    ],
    incoming: [
      "h-[calc(var(--timeline-lead)-var(--timeline-reach))] w-px shrink-0 mark-fill-border timeline-list-first-rail:opacity-0",
      "timeline-list-horizontal-rail:h-px timeline-list-horizontal-rail:w-[max(0px,calc(var(--timeline-inset)-var(--timeline-reach)))]",
    ],
    outgoing:
      "w-px flex-1 mark-fill-border timeline-list-horizontal-rail:h-px timeline-list-horizontal-rail:w-auto timeline-list-last-rail:opacity-0",
    indicator: [
      "mbs-(--timeline-gap) mbe-(--timeline-gap) flex h-(--timeline-drawn) w-(--timeline-mark) shrink-0 items-center justify-center",
      "timeline-list-horizontal-rail:ms-(--timeline-inset) timeline-list-horizontal-rail:me-(--timeline-gap) timeline-list-horizontal-rail:mbs-0 timeline-list-horizontal-rail:mbe-0 timeline-list-horizontal-rail:h-(--timeline-mark) timeline-list-horizontal-rail:w-(--timeline-drawn)",
    ],
    mark: "flex flex-none items-center justify-center rounded-full",
    glyph: "[display:var(--timeline-glyph)] size-3/5 forced-colors:text-[Canvas]",
    content: [
      "min-w-0 flex-1 wrap-anywhere timeline-list-placed:[grid-area:content] timeline-list-horizontal-cell:max-w-64 timeline-list-horizontal-cell:[grid-area:content/1]",
      "text-start timeline-list-even-cell:@min-[32rem]/timeline-list:text-end",
      "pbs-[calc(var(--timeline-lead)-var(--timeline-line)/2)] pbe-(--timeline-trail)",
      "timeline-list-alternate-cell:@max-[32rem]/timeline-list:[[data-slot=timeline-list-opposite]~&]:pbs-0",
      "timeline-list-horizontal-cell:ps-(--timeline-inset) timeline-list-horizontal-cell:pe-(--timeline-trail) timeline-list-horizontal-cell:pbs-2 timeline-list-horizontal-cell:pbe-0",
    ],
    title: "",
    time: "text-sm block text-foreground",
    description: "",
  },
  variants: {
    // The mark the Item draws along the direction of travel: the lane-sized mark, the default dot,
    // which keeps its 8.75px in an `md` or `lg` lane, or none. The indicator takes that length, and
    // the incoming connector runs from the Item's start to the mark's reach, so a dot still centers
    // on the first text line with the rail gap on both sides, and a markless Item's line reaches its
    // text.
    drawn: {
      lane: { item: "[--timeline-drawn:var(--timeline-mark)]" },
      dot: { item: "[--timeline-drawn:var(--timeline-dot)]" },
      none: { item: "[--timeline-drawn:0px] [--timeline-reach:0px]" },
    },
    layout: {
      vertical: { root: "" },
      alternate: { root: "@container/timeline-list" },
      horizontal: {
        root: "grid auto-cols-[minmax(--spacing(40),1fr)] grid-flow-col grid-rows-[[rail]_auto_[content]_1fr] timeline-list-has-opposite:grid-rows-[[opposite]_auto_[rail]_auto_[content]_1fr]",
      },
    },
    spacing: {
      default: { root: "[--timeline-space:--spacing(8)]" },
      compact: { root: "[--timeline-space:--spacing(4)]" },
    },
    indicatorSize: {
      dot: {
        root: "[--timeline-error-radius:0px] [--timeline-error-rotate:45deg] [--timeline-error-size:calc(var(--timeline-dot)*0.7071)] [--timeline-glyph:none] [--timeline-halo:1px] [--timeline-mark:var(--timeline-dot)]",
      },
      md: { root: "[--timeline-mark:--spacing(6)]" },
      lg: { root: "[--timeline-mark:--spacing(8)]" },
    },
    status: {
      none: { mark: "size-(--timeline-dot) mark-fill-foreground" },
      complete: { mark: "size-(--timeline-mark) mark-fill-primary", glyph: "text-primary-foreground" },
      current: {
        mark: "size-(--timeline-mark) border-(length:--timeline-halo) border-primary",
        glyph: "[display:block] size-1/2 rounded-full mark-fill-primary",
      },
      upcoming: { mark: "size-(--timeline-mark) border-(length:--timeline-halo) border-muted-foreground" },
      error: {
        mark: "size-(--timeline-error-size) [rotate:var(--timeline-error-rotate)] rounded-(--timeline-error-radius) mark-fill-error",
        glyph: "text-error-foreground",
      },
    },
  },
  defaultVariants: {
    drawn: "lane",
    layout: "vertical",
    spacing: "default",
    indicatorSize: "dot",
    status: "none",
  },
});
