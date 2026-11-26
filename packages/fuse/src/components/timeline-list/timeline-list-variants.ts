/**
 * The module-private recipe for TimelineList's parts. The public entry does not export it, because
 * no other component borrows it.
 *
 * An Item in a plain vertical list is a flex row of its `TimelineList.Indicator`, a lane wide, and
 * its `TimelineList.Content`, which takes the rest. Every other Item is a grid whose cells take
 * fixed area names, `opposite`, `rail` and `content`: a vertical list with an opposite cell and an
 * alternate list lay them out with `grid-template-areas`, so swapping sides on even Items or
 * stacking the date in the fold is a template change, and a horizontal Item places them on the
 * Root's named rows through a row subgrid. An Item without an opposite cell keeps its rail where
 * its neighbors have theirs.
 *
 * The Indicator is the rail, a flex box along the direction of travel: the incoming connector, the
 * lane and the outgoing connector, which takes the rest. The lane holds the `TimelineList.Mark` or
 * the consumer's node. The gap around the mark is a margin on the lane, so an empty lane, which is
 * hidden, leaves an unbroken line. The first incoming and the last outgoing connector keep their
 * space and paint nothing, through `opacity: 0`, which forced-colors mode keeps.
 *
 * The Root sets the values several parts share: `--timeline-line`, the 22px line of a Title from
 * level 3 down, `text-base leading-snug`; `--timeline-mark`, the lane size; `--timeline-gap`, the
 * rail gap; `--timeline-space`, the space between Items; and `--timeline-lead`, the distance from
 * an Item's start to its mark's center, `max(line / 2, mark / 2 + gap)`. The text cells start
 * `lead - line / 2` down. The Indicator sets `--timeline-drawn`, the length the lane draws along
 * the rail: the lane, or the 8.75px dot that a childless Mark in an Item without `status` draws.
 * Its incoming connector is `lead - drawn / 2 - gap` long, so the mark's center is the first text
 * line's center and the gap on both sides of it is `gap`. Every other length sits on the part that
 * uses it, under the variants in `styles/timeline-list-variants.css`, which match a part by its own
 * list and its own Item, so a list nested in a Content keeps its own layout, lane and status.
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
 * rotated square. The childless Mark renders the check, the cross and the current dot whatever
 * the size, and its status classes show one; the Root's `--timeline-glyph` hides the check and the
 * cross at dot size, and its `--timeline-error-*` properties turn the error circle into the
 * rotated square there.
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
      // A plain vertical Item is a flex row, not a grid of two tracks: the Figma kit draws this
      // layout, and its build maps neither a grid whose items place themselves nor one whose row a
      // stretched rail and a cell of editable text share, in
      // `packages/fuse-figma/src/components/grid-layout.ts`.
      "flex gap-x-3",
      // Whether a shown Item comes before and after this one, `1` or `0`, and the Item's own lengths,
      // which its cells and rail parts read: the space after it, times `--timeline-has-next`, and
      // the horizontal start inset of its text and mark, times `--timeline-has-previous`. The
      // incoming connector paints at an opacity of `--timeline-has-previous`, and the outgoing one
      // at `--timeline-has-next`.
      "[--timeline-has-next:1] [--timeline-has-previous:1] timeline-list-first-item:[--timeline-has-previous:0] timeline-list-last-item:[--timeline-has-next:0]",
      "[--timeline-inset:0px] [--timeline-trail:calc(var(--timeline-space)*var(--timeline-has-next))] timeline-list-horizontal:[--timeline-inset:calc(var(--timeline-gap)*var(--timeline-has-previous))]",
      "timeline-list-opposite:grid timeline-list-opposite:grid-cols-[7rem_var(--timeline-mark)_minmax(0,1fr)] timeline-list-opposite:[grid-template-areas:'opposite_rail_content']",
      // Alternate, wide: the body and the opposite cell on either side of the rail, swapped on even
      // Items.
      "timeline-list-alternate:grid timeline-list-alternate:@min-[32rem]/timeline-list:grid-cols-[minmax(0,1fr)_var(--timeline-mark)_minmax(0,1fr)]",
      "timeline-list-alternate:@min-[32rem]/timeline-list:[grid-template-areas:'opposite_rail_content'] timeline-list-alternate:@min-[32rem]/timeline-list:timeline-list-even-item:[grid-template-areas:'content_rail_opposite']",
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
      "leading-(--timeline-line) wrap-anywhere empty:hidden [&>[data-timeline-list-part=time]]:leading-(--timeline-line)",
      "pbs-[calc(var(--timeline-lead)-var(--timeline-line)/2)] pbe-(--timeline-trail) timeline-list-alternate-cell:@max-[32rem]/timeline-list:pbe-0",
      "timeline-list-horizontal-cell:ps-(--timeline-inset) timeline-list-horizontal-cell:pe-(--timeline-trail) timeline-list-horizontal-cell:pbs-2 timeline-list-horizontal-cell:pbe-2",
    ],
    indicator: [
      // The length the lane draws along the rail: the lane, or the 8.75px dot of a childless Mark in
      // an Item without status. The incoming connector runs from the Item's start to the mark's
      // reach, half that length and the gap before the mark; an empty lane is hidden and reaches
      // nothing.
      "[--timeline-drawn:var(--timeline-mark)] timeline-list-dot:[--timeline-drawn:var(--timeline-dot)]",
      "[--timeline-reach:calc(var(--timeline-drawn)/2+var(--timeline-gap))] timeline-list-markless:[--timeline-reach:0px]",
      "flex w-(--timeline-mark) shrink-0 flex-col items-center timeline-list-placed:[grid-area:rail] timeline-list-horizontal-cell:[grid-area:rail/1]",
      "timeline-list-horizontal-cell:h-(--timeline-mark) timeline-list-horizontal-cell:w-auto timeline-list-horizontal-cell:flex-row",
    ],
    incoming: [
      "h-[calc(var(--timeline-lead)-var(--timeline-reach))] w-px shrink-0 mark-fill-border opacity-(--timeline-has-previous)",
      "timeline-list-horizontal-rail:h-px timeline-list-horizontal-rail:w-[max(0px,calc(var(--timeline-inset)-var(--timeline-reach)))]",
    ],
    outgoing:
      "w-px flex-1 mark-fill-border opacity-(--timeline-has-next) timeline-list-horizontal-rail:h-px timeline-list-horizontal-rail:w-auto",
    lane: [
      "mbs-(--timeline-gap) mbe-(--timeline-gap) flex h-(--timeline-drawn) w-(--timeline-mark) shrink-0 items-center justify-center empty:hidden",
      "timeline-list-horizontal-rail:ms-(--timeline-inset) timeline-list-horizontal-rail:me-(--timeline-gap) timeline-list-horizontal-rail:mbs-0 timeline-list-horizontal-rail:mbe-0 timeline-list-horizontal-rail:h-(--timeline-mark) timeline-list-horizontal-rail:w-(--timeline-drawn)",
    ],
    mark: [
      // The mark's size is the drawn length its Indicator sets, the lane or the dot; outside an
      // Indicator it falls back to the lane.
      "flex size-[var(--timeline-drawn,var(--timeline-mark))] flex-none items-center justify-center rounded-full",
      "timeline-list-complete:mark-fill-primary timeline-list-complete:text-primary-foreground",
      "timeline-list-current:border-(length:--timeline-halo) timeline-list-current:border-primary",
      "timeline-list-upcoming:border-(length:--timeline-halo) timeline-list-upcoming:border-muted-foreground",
      "timeline-list-error:mark-fill-error timeline-list-error:text-error-foreground",
    ],
    glyph: "hidden size-3/5 forced-colors:text-[Canvas]",
    halo: "hidden size-1/2 rounded-full mark-fill-primary",
    content: [
      "min-w-0 flex-1 wrap-anywhere timeline-list-placed:[grid-area:content] timeline-list-horizontal-cell:max-w-64 timeline-list-horizontal-cell:[grid-area:content/1]",
      "text-start timeline-list-even-cell:@min-[32rem]/timeline-list:text-end",
      "pbs-[calc(var(--timeline-lead)-var(--timeline-line)/2)] pbe-(--timeline-trail)",
      "timeline-list-alternate-cell:@max-[32rem]/timeline-list:[[data-timeline-list-part=opposite]:not(:empty,[hidden])~&]:pbs-0",
      "timeline-list-horizontal-cell:ps-(--timeline-inset) timeline-list-horizontal-cell:pe-(--timeline-trail) timeline-list-horizontal-cell:pbs-2 timeline-list-horizontal-cell:pbe-0",
    ],
    title: "",
    time: "text-sm block text-foreground",
    description: "",
  },
  variants: {
    // The childless mark draws the status: the 8.75px dot without one, and at dot size the error's
    // rotated square. A mark with children is a lane-sized node in the status's colors, or a muted
    // fill without one; a glyph on a fill takes Canvas in forced-colors mode.
    kind: {
      default: {
        mark: [
          "timeline-list-unstated:mark-fill-foreground timeline-list-error:size-(--timeline-error-size) timeline-list-error:[rotate:var(--timeline-error-rotate)] timeline-list-error:rounded-(--timeline-error-radius)",
          // The glyph the status draws, a direct child the status classes show; `--timeline-glyph`
          // hides the check and the cross at dot size.
          "timeline-list-complete:[&>[data-glyph=check]]:[display:var(--timeline-glyph)] timeline-list-error:[&>[data-glyph=cross]]:[display:var(--timeline-glyph)] timeline-list-current:[&>[data-glyph=halo]]:block",
        ],
      },
      custom: {
        mark: [
          "timeline-list-unstated:mark-fill-muted timeline-list-unstated:text-foreground forced-colors:timeline-list-unstated:text-[Canvas] forced-colors:timeline-list-complete:text-[Canvas] forced-colors:timeline-list-error:text-[Canvas] [&>svg]:size-3/5",
          // A ringed mark's glyph takes the ring's color.
          "timeline-list-current:text-primary timeline-list-upcoming:text-muted-foreground",
        ],
      },
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
  },
  defaultVariants: {
    kind: "default",
    layout: "vertical",
    spacing: "default",
    indicatorSize: "dot",
  },
});
