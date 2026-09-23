import { tv } from "tailwind-variants";

import { controlInsetMdClass } from "./control-inset";
import { compactCornerClass } from "./corner-radius";

/**
 * Shared layout recipe for the two date pickers. The `range` axis selects one segment
 * row or two; both variants borrow their field box, popup, and grid surfaces from the
 * composed components. FieldGroup owns the read-only fill and the md control height —
 * this recipe emits no control-height rung. A narrow range stacks two content-sized
 * rows; this recipe adds no size axis or glyph background. The input inset keeps
 * segmented rows aligned with Input at both densities.
 */
export const pickerVariants = tv({
  slots: {
    /** The RAC picker root: label, field box, help text and popover in a column. */
    // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- label/field stack gap is layout, not a control rung
    base: "group flex max-w-full min-w-0 flex-col gap-1",
    /** The private FieldGroup around the segment row(s) and the trigger. */
    group: "w-auto",
    /** A public DateInput inside the field box. */
    input: controlInsetMdClass,
    /**
     * The en-dash between a range's two rows: decorative, `aria-hidden`, and the only slot
     * with a colour of its own. It uses role tokens; the forced-colors fallbacks are kept verbatim so the
     * glyph survives a high-contrast theme. Empty on the single-date axis, which renders no
     * separator at all.
     */
    separator: "",
    /**
     * The CalendarBlank glyph in the trigger button. A plain `size-4`: `buttonVariants`
     * only sizes `svg:not([class*='size-'])`, so this class already wins on its own and an
     * `!` would just be noise.
     */
    icon: "size-4 transition-colors",
    /**
     * The calendar trigger's placement inside the field box. Both states share one grid
     * model, and only the column template and the separator toggle at 24rem, so the
     * range arm's placements are live at every width. The trigger sits inside the field
     * box, so it takes the compact corner instead of Button's `--radius-button`.
     */
    trigger: compactCornerClass,
    /**
     * The styled Dialog inside the popover. Both padding utilities are needed: the dialog
     * recipe sets `p-6` on its base and `p-4` under `[data-placement]`, which is exactly the
     * popover case.
     */
    dialog: "p-0 [[data-placement]>&]:p-0",
    /** The public Calendar / RangeCalendar inside the dialog — see the `range` axis. */
    calendar: "",
    /**
     * The responsive pane holding presets above the calendar on small viewports and
     * beside it on larger ones. Empty
     * unless there are presets: a lone calendar is a single pane, so it must not inherit the
     * divider, the column gap or the trailing inset the two-pane layout needs
     */
    pane: "",
  },
  variants: {
    /**
     * Whether the field box holds two segment rows and a separator. Every geometric
     * difference between the two pickers hangs off this one axis.
     */
    range: {
      false: {
        // One row that grows to fill the box.
        group: "min-w-[180px]",
        input: "flex min-w-[150px] flex-1",
        // Calendar's own root carries `p-2`; the popover already provides the card chrome.
        calendar: "border-none",
      },
      true: {
        base: "@container/picker w-full",
        // One grid template in both states; 24rem changes only the column count. Below
        // it the dates stack in the first column beside the row-spanning trigger and the
        // box opts out of FieldGroup's md height so the two rows size to their content.
        // Above it the dates run in one row — start, en-dash, end, trigger — and the end
        // column absorbs the slack.
        //
        // The breakpoint is spelled into each class string rather than hoisted into a
        // constant: Tailwind scans the built JS text, and an interpolated candidate
        // generates no utility. `picker.test.ts` names it once and pins every slot.
        group:
          "grid min-w-[208px] grid-cols-[minmax(0,1fr)_auto] @max-[24rem]/picker:h-auto @min-[24rem]/picker:grid-cols-[auto_auto_minmax(0,1fr)_auto]",
        input: "flex items-center",
        // Two rows share the box and only the end row grows; the wide template's
        // `minmax(0,1fr)` end column is what hands it the slack.
        separator:
          "hidden text-foreground group-disabled:text-muted-foreground @min-[24rem]/picker:col-start-2 @min-[24rem]/picker:inline forced-colors:text-[ButtonText] forced-colors:group-disabled:text-[GrayText]",
        trigger:
          "col-start-2 row-span-2 row-start-1 @min-[24rem]/picker:col-start-4 @min-[24rem]/picker:row-span-1",
        // RangeCalendar's root is bare and this dialog is `p-0`, so the grid would otherwise
        // sit flush against the popover border.
        calendar: "p-2",
      },
    },
    /**
     * Whether the caller handed over a preset pane that would actually paint. The call site
     * decides that (`presetGroup={showPresets && <Group />}` collapses to `false`, not
     * `undefined`), so this axis takes the answer, never the node. Single-date only.
     *
     * The stack-to-row flip stays a viewport `sm:` query: the pane lives in the portalled
     * popover, outside the picker root's `@container/picker`, and the popover sizes to its
     * own content, so a local container query would be circular. The range field's own
     * breakpoint is a genuine container query because its box is inside the picker root.
     */
    hasPresets: {
      true: {
        pane: "sm:flex-row sm:divide-x sm:divide-y-0 sm:pr-3 flex flex-col gap-3 divide-y pb-3",
      },
      false: {
        pane: "",
      },
    },
  },
  defaultVariants: {
    range: false,
    hasPresets: false,
  },
});
